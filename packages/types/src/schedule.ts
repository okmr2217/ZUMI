import { z } from "zod";

/**
 * 繰り返しタイプ6種の設定。docs/03-duty-log-review-account.md の
 * 「繰り返しタイプ」「期日計算の境界ルール」に合わせた zod スキーマを定義元とし、
 * TypeScript の型はスキーマから導出する。packages/db（`duties.scheduleConfig`）と
 * web/notify の双方がここを参照し、期日計算・バリデーションのズレを防ぐ。
 *
 * 曜日は `Date#getDay()` と同じく 0=日 〜 6=土。
 */

const weekdaySchema = z.number().int().min(0).max(6);

/** 曜日の配列。1つ以上・重複なし */
const weekdaysSchema = z
  .array(weekdaySchema)
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, { message: "曜日が重複しています" });

/** `YYYY-MM-DD` 形式で、実在する日付 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const [y, m, d] = value.split("-").map(Number) as [number, number, number];
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
    },
    { message: "存在しない日付です" },
  );

const dailySchema = z.object({ type: z.literal("DAILY") });

const weekdaysConfigSchema = z.object({
  type: z.literal("WEEKDAYS"),
  weekdays: weekdaysSchema,
});

/** 隔週の曜日。v1 は `every` = 2 固定（3週ごと以上はユースケースが薄いため） */
const nthWeekSchema = z.object({
  type: z.literal("NTH_WEEK"),
  weekdays: weekdaysSchema,
  every: z.literal(2),
  anchor: dateStringSchema,
});

/**
 * 月次の日付指定。29〜31日も指定でき、該当日がない月は月末に丸める
 * （丸めは期日計算側の責務）。
 */
const monthlyByDaySchema = z.object({
  type: z.literal("MONTHLY"),
  dayOfMonth: z.number().int().min(1).max(31),
});

/** 月次の第N曜日。第5曜日は月によって存在しないため、1〜4 と最終（-1）のみ */
const monthlyByNthSchema = z.object({
  type: z.literal("MONTHLY"),
  nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]),
  weekday: weekdaySchema,
});

const weeklyCountSchema = z.object({
  type: z.literal("WEEKLY_COUNT"),
  timesPerWeek: z.number().int().min(1).max(7),
});

/** 前回**完了**から N 日。上限は年次イベントをスコープ外にしているため 90 日とする */
const sinceLastSchema = z.object({
  type: z.literal("SINCE_LAST"),
  days: z.number().int().min(1).max(90),
});

/**
 * `MONTHLY` は日付指定と第N曜日の2形態があり、どちらか一方だけを持つ。
 * 未知キーを除去する通常の object だと、両方のキーを持つ設定（`{ dayOfMonth, nth, weekday }`）が
 * 日付指定として黙って通ってしまうため、ここだけ strict にして弾く。
 *
 * `type` が同じ形態を2つ持つため `z.discriminatedUnion` は使えず、全体を `z.union` にしている。
 */
export const scheduleConfigSchema = z.union([
  dailySchema,
  weekdaysConfigSchema,
  nthWeekSchema,
  monthlyByDaySchema.strict(),
  monthlyByNthSchema.strict(),
  weeklyCountSchema,
  sinceLastSchema,
]);

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;
export type ScheduleType = ScheduleConfig["type"];
export type MonthlyNth = z.infer<typeof monthlyByNthSchema>["nth"];

/** 期日確定型（今日が対象かが一意に決まる）かどうか */
export const FIXED_DUE_SCHEDULE_TYPES: ReadonlySet<ScheduleType> = new Set([
  "DAILY",
  "WEEKDAYS",
  "NTH_WEEK",
  "MONTHLY",
]);

export function isFixedDueSchedule(type: ScheduleType): boolean {
  return FIXED_DUE_SCHEDULE_TYPES.has(type);
}
