import { describe, expect, it } from "vitest";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { PRESET_ICONS, PRESET_ICON_NAMES } from "./icons";
import { scheduleConfigSchema } from "./schedule";
import { DUTY_TEMPLATES } from "./templates";

describe("PRESET_ICONS", () => {
  it("16〜24 個で、名前が重複しない", () => {
    expect(PRESET_ICONS.length).toBeGreaterThanOrEqual(16);
    expect(PRESET_ICONS.length).toBeLessThanOrEqual(24);
    expect(new Set(PRESET_ICON_NAMES).size).toBe(PRESET_ICONS.length);
  });

  it("すべて lucide に実在するアイコン名", () => {
    for (const name of PRESET_ICON_NAMES) {
      expect(dynamicIconImports, name).toHaveProperty([name]);
    }
  });
});

describe("DUTY_TEMPLATES", () => {
  it("10件で、id が重複しない", () => {
    expect(DUTY_TEMPLATES).toHaveLength(10);
    expect(new Set(DUTY_TEMPLATES.map((t) => t.id)).size).toBe(10);
  });

  it("アイコンはプリセットに含まれる", () => {
    for (const template of DUTY_TEMPLATES) {
      expect(PRESET_ICON_NAMES, template.id).toContain(template.icon);
    }
  });

  it("ゴミ出し以外の初期設定はそのまま scheduleConfigSchema を通る", () => {
    for (const template of DUTY_TEMPLATES.filter((t) => t.id !== "garbage")) {
      expect(scheduleConfigSchema.safeParse(template.scheduleConfig).success, template.id).toBe(
        true,
      );
    }
  });

  it("ゴミ出しは曜日が未選択のため通らず、曜日を入れると通る", () => {
    const garbage = DUTY_TEMPLATES.find((t) => t.id === "garbage")!;
    expect(garbage.scheduleConfig).toEqual({ type: "WEEKDAYS", weekdays: [] });
    expect(scheduleConfigSchema.safeParse(garbage.scheduleConfig).success).toBe(false);
    expect(
      scheduleConfigSchema.safeParse({ ...garbage.scheduleConfig, weekdays: [2, 5] }).success,
    ).toBe(true);
  });
});
