import { describe, expect, it } from "vitest";
import { DUTY_TEMPLATES, getNextDue, type ScheduleConfig } from "@zumi/types";
import { defaultAnchor, draftFromConfig, toScheduleConfig, toggleWeekday } from "./schedule-draft";
import { formatNextDue, summarizeSchedule } from "./schedule-text";

// 2026-11-02 は月曜
const TODAY = "2026-11-02";

describe("draftFromConfig / toScheduleConfig", () => {
  const configs: ScheduleConfig[] = [
    { type: "DAILY" },
    { type: "WEEKDAYS", weekdays: [2, 5] },
    { type: "NTH_WEEK", weekdays: [3], every: 2, anchor: "2026-08-05" },
    { type: "MONTHLY", dayOfMonth: 31 },
    { type: "MONTHLY", nth: -1, weekday: 5 },
    { type: "WEEKLY_COUNT", timesPerWeek: 3 },
    { type: "SINCE_LAST", days: 14 },
  ];

  it.each(configs)("$type を往復しても変わらない", (config) => {
    expect(toScheduleConfig(draftFromConfig(config, TODAY))).toEqual(config);
  });

  it("テンプレートのゴミ出しは曜日を選ぶまで null", () => {
    const garbage = DUTY_TEMPLATES.find((t) => t.id === "garbage")!;
    const draft = draftFromConfig(garbage.scheduleConfig, TODAY);
    expect(toScheduleConfig(draft)).toBeNull();
    expect(toScheduleConfig(toggleWeekday(draft, 2, TODAY))).toEqual({
      type: "WEEKDAYS",
      weekdays: [2],
    });
  });

  it("選択肢を切り替えても、ほかのタイプの値は残る", () => {
    const draft = draftFromConfig({ type: "SINCE_LAST", days: 14 }, TODAY);
    const switched = { ...draft, kind: "DAILY" as const };
    expect(toScheduleConfig({ ...switched, kind: "SINCE_LAST" })).toEqual({
      type: "SINCE_LAST",
      days: 14,
    });
  });
});

describe("隔週の起点日", () => {
  it("選んだ曜日のうち今日以降で最初の日（今日を含む）", () => {
    expect(defaultAnchor([3], TODAY)).toBe("2026-11-04");
    expect(defaultAnchor([1], TODAY)).toBe(TODAY);
    expect(defaultAnchor([0, 5], TODAY)).toBe("2026-11-06");
    expect(defaultAnchor([], TODAY)).toBe(TODAY);
  });

  it("隔週にすると NTH_WEEK になり、プレビューは起点日から始まる", () => {
    let draft = draftFromConfig({ type: "DAILY" }, TODAY);
    draft = { ...draft, kind: "WEEKDAYS", biweekly: true };
    draft = toggleWeekday(draft, 3, TODAY);
    const config = toScheduleConfig(draft);
    expect(config).toEqual({ type: "NTH_WEEK", weekdays: [3], every: 2, anchor: "2026-11-04" });
    const next = getNextDue(
      {
        duty: {
          scheduleConfig: config!,
          createdAt: new Date("2026-11-02T01:00:00Z"),
          archivedAt: null,
        },
        logs: [],
        pauses: [],
        timeZone: "Asia/Tokyo",
        weekStart: 1,
      },
      TODAY,
    );
    expect(next).toEqual({ type: "DATE", date: "2026-11-04" });
  });

  it("起点日を手で選んだら、曜日を変えても動かさない", () => {
    let draft = draftFromConfig(
      { type: "NTH_WEEK", weekdays: [3], every: 2, anchor: "2026-11-11" },
      TODAY,
    );
    draft = toggleWeekday(draft, 1, TODAY);
    expect(draft.anchor).toBe("2026-11-11");
  });
});

describe("文言", () => {
  it("繰り返しの要約は週の始まりの順に曜日を並べる", () => {
    expect(summarizeSchedule({ type: "WEEKDAYS", weekdays: [0, 2, 5] }, 1)).toBe("火・金・日");
    expect(summarizeSchedule({ type: "WEEKDAYS", weekdays: [0, 2, 5] }, 0)).toBe("日・火・金");
    expect(summarizeSchedule({ type: "NTH_WEEK", weekdays: [3], every: 2, anchor: TODAY }, 1)).toBe(
      "隔週 水",
    );
    expect(summarizeSchedule({ type: "MONTHLY", nth: -1, weekday: 5 }, 1)).toBe("毎月最終金曜");
    expect(summarizeSchedule({ type: "MONTHLY", dayOfMonth: 27 }, 1)).toBe("毎月27日");
    expect(summarizeSchedule({ type: "SINCE_LAST", days: 2 }, 1)).toBe("前回から2日空いたら");
  });

  it("次の期日のプレビュー", () => {
    expect(formatNextDue({ type: "DATE", date: "2026-11-06" }, TODAY)).toBe("次の期日：11/6（金）");
    expect(formatNextDue({ type: "DATE", date: TODAY }, TODAY)).toBe("次の期日：今日 11/2（月）");
    expect(formatNextDue({ type: "DATE", date: "2026-11-03" }, TODAY)).toBe(
      "次の期日：明日 11/3（火）",
    );
    expect(
      formatNextDue({ type: "WEEKLY_COUNT", remaining: 1, weekEnd: "2026-11-08" }, TODAY),
    ).toBe("今週あと1回・日曜まで");
    expect(formatNextDue(null, TODAY)).toBeNull();
  });
});
