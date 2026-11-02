import { describe, expect, it } from "vitest";
import { DUTY_TEMPLATES } from "@zumi/types";
import { dutyInputSchema } from "./duty-input";

const valid = {
  name: "ゴミ出し（可燃）",
  icon: "trash-2",
  scheduleConfig: { type: "WEEKDAYS", weekdays: [2, 5] },
  notifyPrevNight: true,
  noteEnabled: false,
};

describe("dutyInputSchema", () => {
  it("正しい入力を通し、名前の前後の空白を除く", () => {
    const result = dutyInputSchema.parse({ ...valid, name: "  お風呂 " });
    expect(result.name).toBe("お風呂");
    expect(result.scheduleConfig).toEqual({ type: "WEEKDAYS", weekdays: [2, 5] });
  });

  it("名前が空白だけ・31文字以上なら弾く", () => {
    expect(dutyInputSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(dutyInputSchema.safeParse({ ...valid, name: "あ".repeat(31) }).success).toBe(false);
    expect(dutyInputSchema.safeParse({ ...valid, name: "あ".repeat(30) }).success).toBe(true);
  });

  it("プリセットにないアイコン・絵文字を弾く", () => {
    expect(dutyInputSchema.safeParse({ ...valid, icon: "rocket" }).success).toBe(false);
    expect(dutyInputSchema.safeParse({ ...valid, icon: "🗑️" }).success).toBe(false);
  });

  it("scheduleConfig を scheduleConfigSchema で検証する", () => {
    const invalidConfigs = [
      { type: "WEEKDAYS", weekdays: [] },
      { type: "NTH_WEEK", weekdays: [3], every: 3, anchor: "2026-11-04" },
      { type: "MONTHLY", nth: 5, weekday: 1 },
      { type: "MONTHLY", dayOfMonth: 1, nth: 1, weekday: 1 },
      { type: "SINCE_LAST", days: 0 },
      { type: "YEARLY" },
    ];
    for (const scheduleConfig of invalidConfigs) {
      expect(
        dutyInputSchema.safeParse({ ...valid, scheduleConfig }).success,
        JSON.stringify(scheduleConfig),
      ).toBe(false);
    }
  });

  it("dueTime などの未知の項目は保存しない", () => {
    const result = dutyInputSchema.parse({ ...valid, dueTime: "08:00", scheduleType: "DAILY" });
    expect(result).not.toHaveProperty("dueTime");
    expect(result).not.toHaveProperty("scheduleType");
  });

  it("テンプレートのゴミ出しは曜日を選ぶまで通らない", () => {
    const garbage = DUTY_TEMPLATES.find((t) => t.id === "garbage")!;
    const input = {
      ...valid,
      name: garbage.name,
      icon: garbage.icon,
      scheduleConfig: garbage.scheduleConfig,
    };
    expect(dutyInputSchema.safeParse(input).success).toBe(false);
  });
});
