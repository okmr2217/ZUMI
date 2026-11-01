import { sql } from "drizzle-orm";
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
 * 値が変わっていなければ書き込まない。行がない場合（作成フックの失敗など）は
 * ここで作り直し、「今日」の判定の前提になる行を必ず揃える。
 */
export async function syncUserTimezone(userId: string, timezone: string) {
  await getDb()
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId, timezone })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { timezone },
      setWhere: sql`${userSettings.timezone} <> ${timezone}`,
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
