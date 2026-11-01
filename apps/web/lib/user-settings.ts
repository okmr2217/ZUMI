import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import type { WeekStart } from "@zumi/types";
import { userSettings } from "@zumi/db/schema";
import { getDb } from "./db";

/**
 * サインアップ時（better-auth の `databaseHooks.user.create.after`）に
 * `user_settings` の行を作る。タイムゾーンは初期値 `Asia/Tokyo` のまま作り、
 * アプリを開いたときにブラウザの値で更新する（`syncUserTimezone`）。
 */
export async function createUserSettings(userId: string) {
  await getDb()
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId })
    .onConflictDoNothing({ target: userSettings.userId });
}

/**
 * ブラウザのタイムゾーンで `user_settings.timezone` を更新する。
 * 設定画面で手で選んでいる（`timezone_auto` が false）か、値が変わっていなければ書き込まない。
 * 手動の判定をサーバー側で持つのは、別の端末で開いたときにもその端末の値で上書きしないため。
 * 行がない場合（作成フックの失敗など）は
 * ここで作り直し、「今日」の判定の前提になる行を必ず揃える。
 */
export async function syncUserTimezone(userId: string, timezone: string) {
  await getDb()
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId, timezone })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { timezone },
      setWhere: and(eq(userSettings.timezoneAuto, true), ne(userSettings.timezone, timezone)),
    });
}

/**
 * IANA のタイムゾーン名を正規の表記（例: `asia/tokyo` → `Asia/Tokyo`）にそろえる。
 * `Intl` が解釈できない名前、および `+09:00` のようなオフセット表記は null を返す。
 */
export function canonicalizeTimeZone(timezone: string): string | null {
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions()
      .timeZone;
    return /^[+-]/.test(resolved) ? null : resolved;
  } catch {
    return null;
  }
}

/** 週の始まり（1=月曜 / 0=日曜） */
export const weekStartSchema = z.union([z.literal(0), z.literal(1)]);

/** 設定モーダルの「表示」から送る値 */
export const displaySettingsPatchSchema = z.object({ weekStart: weekStartSchema }).strict();

/**
 * 週の始まりを更新する。週N回・達成率・週次サマリーはこの区切りで集計し、
 * 過去の週も新しい区切りで再計算する（docs/03 の境界ルール）ので、ここでは値を書き換えるだけ。
 */
export async function updateWeekStart(userId: string, weekStart: WeekStart) {
  await getDb()
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId, weekStart })
    .onConflictDoUpdate({ target: userSettings.userId, set: { weekStart } });
}
