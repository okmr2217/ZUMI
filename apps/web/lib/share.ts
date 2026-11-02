import { eq } from "drizzle-orm";
import { z } from "zod";
import { shareTokens } from "@zumi/db/schema";
import type { Db, UserCalendar } from "./duties";
import { loadWeeklySummary, type WeeklySummary } from "./review";

/**
 * シェア画像（docs/03「シェア画像の設計方針」、docs/09「フェーズ6」）。
 *
 * シェアボタンを押した時点の週次サマリーを `share_tokens` に固定して持ち、`/og/w/:token` はそれを描くだけにする。
 * 開くたびに集計し直すと、リンクを知っている人にその後の記録まで見せ続けることになるため。
 * 数字は振り返りタブと同じ `loadWeeklySummary`（`getWeeklyAchievement` の合計）から取り、ここで集計し直さない。
 */

/** Duty 1件の行。`WeeklySummary` の Duty から、id など画像に要らないものを除いたもの */
const shareCardDutySchema = z.object({
  name: z.string(),
  icon: z.string(),
  schedule: z.string(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * 画像に描く値。`WeeklySummary` から、Duty の id など画像に要らないものを除いたもの。
 * `share_tokens.card` は JSON の text なので、読み込み時にこの形で検証する（docs/03「シェア画像の運用」）。
 * 余計なキーは落とす（画像に要らない値を描画側へ渡さないため）
 */
const shareCardSchema = z.object({
  weekStart: z.iso.date(),
  weekEnd: z.iso.date(),
  weekNumber: z.number().int().positive(),
  isCurrentWeek: z.boolean(),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  diff: z.number().int(),
  caption: z.string(),
  duties: z.array(shareCardDutySchema),
});

export type ShareCard = z.infer<typeof shareCardSchema>;
export type ShareCardDuty = z.infer<typeof shareCardDutySchema>;

/** 保存したカードを検証する。形が合わない古い行は null（呼び出し側で 404 にする） */
export function parseShareCard(value: unknown): ShareCard | null {
  const parsed = shareCardSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toShareCard(summary: WeeklySummary): ShareCard {
  return {
    weekStart: summary.weekStart,
    weekEnd: summary.weekEnd,
    weekNumber: summary.weekNumber,
    isCurrentWeek: summary.isCurrentWeek,
    done: summary.done,
    total: summary.total,
    diff: summary.diff,
    caption: summary.caption,
    duties: summary.duties.map(({ name, icon, schedule, done, total }) => ({
      name,
      icon,
      schedule,
      done,
      total,
    })),
  };
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** 128bit の乱数を base64url（22文字）にしたトークン */
export function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function isShareToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

export function shareImagePath(token: string): string {
  return `/og/w/${token}`;
}

/**
 * `week`（週の初日）のサマリーを今の時点で固定し、トークンを発行する。
 * 同じ週を前に発行していれば、トークンごと作り直す（古い URL は 404 になる）。
 * 画像はトークンごとに変わらないので、`/og/w/:token` をキャッシュできる（期間は lib/share-image.tsx）。
 */
export async function issueShareToken(
  db: Db,
  userId: string,
  week: string,
  today: string,
  calendar: UserCalendar,
): Promise<{ token: string; card: ShareCard }> {
  const card = toShareCard(await loadWeeklySummary(db, userId, week, today, calendar));
  const token = generateShareToken();
  const row = { token, card: { ...card }, createdAt: new Date() };
  await db
    .insert(shareTokens)
    .values({ ...row, userId, weekStart: card.weekStart })
    .onConflictDoUpdate({ target: [shareTokens.userId, shareTokens.weekStart], set: row });
  return { token, card };
}

export async function loadShareCard(db: Db, token: string): Promise<ShareCard | null> {
  if (!isShareToken(token)) return null;
  const row = await db
    .select({ card: shareTokens.card })
    .from(shareTokens)
    .where(eq(shareTokens.token, token))
    .get();
  return row ? parseShareCard(row.card) : null;
}
