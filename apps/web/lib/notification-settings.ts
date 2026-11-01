import { z } from "zod";
import { eq } from "drizzle-orm";
import { userSettings } from "@zumi/db/schema";
import { getDb } from "./db";
import { canonicalizeTimeZone } from "./user-settings";
import { DEFAULT_EVENING_AT, DEFAULT_MORNING_AT } from "./notification-defaults";

/** `HH:MM`（24時間制、0埋め）。notify はこの文字列を現地時刻と突き合わせる。 */
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const timezone = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    const canonical = canonicalizeTimeZone(value);
    if (!canonical) {
      ctx.addIssue({ code: "custom", message: "invalid timezone" });
      return z.NEVER;
    }
    return canonical;
  });

/**
 * 設定画面から送る部分更新。送った項目だけを書き換える。
 * `timezone` だけを送ると手で選んだ扱い（`timezoneAuto: false`）になる。「自動」に戻すときは
 * `timezoneAuto: true` とその端末のブラウザの値を一緒に送る。`timezoneAuto` だけは送れない。
 */
export const notificationSettingsPatchSchema = z
  .object({
    morningNotifyEnabled: z.boolean(),
    morningNotifyAt: time,
    eveningNotifyEnabled: z.boolean(),
    eveningNotifyAt: time,
    weeklySummaryEnabled: z.boolean(),
    weeklySummaryAt: time,
    timezone,
    timezoneAuto: z.boolean(),
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0)
  .refine((patch) => patch.timezoneAuto === undefined || patch.timezone !== undefined);

export type NotificationSettingsPatch = z.infer<typeof notificationSettingsPatchSchema>;

export type NotificationSettings = {
  timezone: string;
  timezoneAuto: boolean;
  morningNotifyEnabled: boolean;
  morningNotifyAt: string | null;
  eveningNotifyEnabled: boolean;
  eveningNotifyAt: string | null;
  weeklySummaryEnabled: boolean;
  weeklySummaryAt: string;
  weekStart: 0 | 1;
};

const columns = {
  timezone: userSettings.timezone,
  timezoneAuto: userSettings.timezoneAuto,
  morningNotifyEnabled: userSettings.morningNotifyEnabled,
  morningNotifyAt: userSettings.morningNotifyAt,
  eveningNotifyEnabled: userSettings.eveningNotifyEnabled,
  eveningNotifyAt: userSettings.eveningNotifyAt,
  weeklySummaryEnabled: userSettings.weeklySummaryEnabled,
  weeklySummaryAt: userSettings.weeklySummaryAt,
  weekStart: userSettings.weekStart,
};

/** 行がなければ（作成フックの失敗など）作ってから返す。 */
export async function getNotificationSettings(userId: string): Promise<NotificationSettings> {
  const db = getDb();
  const [row] = await db.select(columns).from(userSettings).where(eq(userSettings.userId, userId));
  if (row) return row;

  const [created] = await db
    .insert(userSettings)
    .values({ id: crypto.randomUUID(), userId })
    .onConflictDoUpdate({ target: userSettings.userId, set: { userId } })
    .returning(columns);
  if (!created) throw new Error("user_settings の行を作れませんでした");
  return created;
}

export async function updateNotificationSettings(
  userId: string,
  patch: NotificationSettingsPatch,
): Promise<NotificationSettings> {
  const set: NotificationSettingsPatch = { ...patch };
  if (patch.timezone !== undefined) set.timezoneAuto = patch.timezoneAuto ?? false;

  // 時刻が未設定のまま ON にされたら初期値で埋める。notify は時刻が null の行を送れない。
  // 今の値を読むのは、時刻を送らずに ON にしたときだけ（行がなければここで作られる）。
  if (
    (patch.morningNotifyEnabled && !patch.morningNotifyAt) ||
    (patch.eveningNotifyEnabled && !patch.eveningNotifyAt)
  ) {
    const current = await getNotificationSettings(userId);
    if (patch.morningNotifyEnabled && !(patch.morningNotifyAt ?? current.morningNotifyAt)) {
      set.morningNotifyAt = DEFAULT_MORNING_AT;
    }
    if (patch.eveningNotifyEnabled && !(patch.eveningNotifyAt ?? current.eveningNotifyAt)) {
      set.eveningNotifyAt = DEFAULT_EVENING_AT;
    }
  }

  const update = () =>
    getDb().update(userSettings).set(set).where(eq(userSettings.userId, userId)).returning(columns);

  let [updated] = await update();
  if (!updated) {
    // 行がない（作成フックの失敗など）ときは作ってから書き直す。
    await getNotificationSettings(userId);
    [updated] = await update();
  }
  if (!updated) throw new Error("user_settings の行がありません");
  return updated;
}
