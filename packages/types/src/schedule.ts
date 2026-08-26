/**
 * 繰り返しタイプ6種の設定。docs/05-tech-stack.md の DB 設計と同一の型を
 * packages/db と共有し、web/notify 双方の期日計算ロジックのズレを防ぐ。
 */
export type ScheduleType =
  | "DAILY"
  | "WEEKDAYS"
  | "NTH_WEEK"
  | "MONTHLY"
  | "WEEKLY_COUNT"
  | "SINCE_LAST";

export type ScheduleConfig =
  | { type: "DAILY" }
  | { type: "WEEKDAYS"; weekdays: number[] }
  | { type: "NTH_WEEK"; weekdays: number[]; every: number; anchor: string }
  | { type: "MONTHLY"; dayOfMonth?: number; nth?: number; weekday?: number }
  | { type: "WEEKLY_COUNT"; timesPerWeek: number }
  | { type: "SINCE_LAST"; days: number };

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
