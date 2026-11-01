import { describe, expect, it } from "vitest";
import { scheduleConfigSchema } from "./schedule";

const valid = (config: unknown) => scheduleConfigSchema.safeParse(config).success;

describe("scheduleConfigSchema", () => {
  it("DAILY", () => {
    expect(valid({ type: "DAILY" })).toBe(true);
  });

  it("WEEKDAYS: 0〜6 の曜日を1つ以上、重複なし", () => {
    expect(valid({ type: "WEEKDAYS", weekdays: [2, 5] })).toBe(true);
    expect(valid({ type: "WEEKDAYS", weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe(true);
    expect(valid({ type: "WEEKDAYS", weekdays: [] })).toBe(false);
    expect(valid({ type: "WEEKDAYS", weekdays: [7] })).toBe(false);
    expect(valid({ type: "WEEKDAYS", weekdays: [-1] })).toBe(false);
    expect(valid({ type: "WEEKDAYS", weekdays: [1.5] })).toBe(false);
    expect(valid({ type: "WEEKDAYS", weekdays: [2, 2] })).toBe(false);
  });

  it("NTH_WEEK: every は 2 固定、anchor は実在する YYYY-MM-DD", () => {
    const base = { type: "NTH_WEEK", weekdays: [3], anchor: "2026-08-05" };
    expect(valid({ ...base, every: 2 })).toBe(true);
    expect(valid({ ...base, every: 1 })).toBe(false);
    expect(valid({ ...base, every: 3 })).toBe(false);
    expect(valid({ ...base, weekdays: [], every: 2 })).toBe(false);
    expect(valid({ ...base, every: 2, anchor: "2026-02-30" })).toBe(false);
    expect(valid({ ...base, every: 2, anchor: "2026-8-5" })).toBe(false);
    expect(valid({ ...base, every: 2, anchor: "2028-02-29" })).toBe(true);
  });

  it("MONTHLY: 日付指定は 1〜31", () => {
    expect(valid({ type: "MONTHLY", dayOfMonth: 1 })).toBe(true);
    expect(valid({ type: "MONTHLY", dayOfMonth: 31 })).toBe(true);
    expect(valid({ type: "MONTHLY", dayOfMonth: 0 })).toBe(false);
    expect(valid({ type: "MONTHLY", dayOfMonth: 32 })).toBe(false);
  });

  it("MONTHLY: 第N曜日は 1〜4 と -1（最終）", () => {
    for (const nth of [1, 2, 3, 4, -1]) {
      expect(valid({ type: "MONTHLY", nth, weekday: 0 })).toBe(true);
    }
    for (const nth of [0, 5, -2]) {
      expect(valid({ type: "MONTHLY", nth, weekday: 0 })).toBe(false);
    }
    expect(valid({ type: "MONTHLY", nth: 1, weekday: 7 })).toBe(false);
    expect(valid({ type: "MONTHLY", nth: 1 })).toBe(false);
  });

  it("MONTHLY: 日付指定と第N曜日を混ぜた設定・どちらもない設定は弾く", () => {
    expect(valid({ type: "MONTHLY", dayOfMonth: 1, nth: 1, weekday: 0 })).toBe(false);
    expect(valid({ type: "MONTHLY" })).toBe(false);
  });

  it("WEEKLY_COUNT: 週 1〜7 回", () => {
    expect(valid({ type: "WEEKLY_COUNT", timesPerWeek: 1 })).toBe(true);
    expect(valid({ type: "WEEKLY_COUNT", timesPerWeek: 7 })).toBe(true);
    expect(valid({ type: "WEEKLY_COUNT", timesPerWeek: 0 })).toBe(false);
    expect(valid({ type: "WEEKLY_COUNT", timesPerWeek: 8 })).toBe(false);
  });

  it("SINCE_LAST: 1〜90 日", () => {
    expect(valid({ type: "SINCE_LAST", days: 1 })).toBe(true);
    expect(valid({ type: "SINCE_LAST", days: 90 })).toBe(true);
    expect(valid({ type: "SINCE_LAST", days: 0 })).toBe(false);
    expect(valid({ type: "SINCE_LAST", days: 91 })).toBe(false);
  });

  it("未知のタイプ（YEARLY など）は弾く", () => {
    expect(valid({ type: "YEARLY" })).toBe(false);
    expect(valid({})).toBe(false);
  });

  it("他のタイプの余分なキーは取り除く", () => {
    expect(scheduleConfigSchema.parse({ type: "DAILY", weekdays: [1] })).toEqual({
      type: "DAILY",
    });
  });
});
