import { eq } from "drizzle-orm";
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

/** 画像に描く値。`WeeklySummary` から、Duty の id など画像に要らないものを除いたもの */
export interface ShareCard {
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
  isCurrentWeek: boolean;
  done: number;
  total: number;
  diff: number;
  caption: string;
  duties: ShareCardDuty[];
}

export interface ShareCardDuty {
  name: string;
  icon: string;
  schedule: string;
  done: number;
  total: number;
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
 * 画像はトークンごとに変わらないので、`/og/w/:token` を長くキャッシュできる。
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
  return row ? (row.card as unknown as ShareCard) : null;
}
