import { describe, expect, it } from "vitest";
import type { DutyLog, DutyPause, ScheduleConfig } from "@zumi/types";
import { collectNotificationItems, summarizeWeek, type NotifyDuty } from "./digest";

// 2026年10月〜11月（月曜始まり）
//  月 火 水 木 金 土 日
//  26 27 28 29 30 31  1
//   2  3  4  5  6  7  8
const MONDAY = "2026-11-02";
const SATURDAY = "2026-11-07";
const SUNDAY = "2026-11-08";

type Log = Pick<DutyLog, "targetDate" | "status">;

function duty(
  name: string,
  scheduleConfig: ScheduleConfig,
  options: {
    sortOrder?: number;
    logs?: Log[];
    pauses?: Pick<DutyPause, "startDate" | "endDate">[];
    archivedAt?: Date | null;
  } = {},
): NotifyDuty {
  return {
    name,
    sortOrder: options.sortOrder ?? 0,
    schedule: {
      duty: {
        scheduleConfig,
        createdAt: new Date("2026-10-01T00:00:00+09:00"),
        archivedAt: options.archivedAt ?? null,
      },
      logs: options.logs ?? [],
      pauses: options.pauses ?? [],
      timeZone: "Asia/Tokyo",
      weekStart: 1,
    },
  };
}

const done = (...dates: string[]): Log[] =>
  dates.map((targetDate) => ({ targetDate, status: "DONE" }));

describe("collectNotificationItems", () => {
  it("期日確定型は今日が期日のものだけ", () => {
    const items = collectNotificationItems(
      [
        duty("プロテイン", { type: "DAILY" }),
        duty("ゴミ出し（可燃）", { type: "WEEKDAYS", weekdays: [1, 4] }),
        duty("資源ゴミ", { type: "WEEKDAYS", weekdays: [2] }),
        duty("家賃", { type: "MONTHLY", dayOfMonth: 27 }),
      ],
      MONDAY,
    );
    expect(items).toEqual([
      { name: "プロテイン", section: "TODAY" },
      { name: "ゴミ出し（可燃）", section: "TODAY" },
    ]);
  });

  it("済・スキップしたものは除く", () => {
    const items = collectNotificationItems(
      [
        duty("プロテイン", { type: "DAILY" }, { logs: done(MONDAY) }),
        duty("ストレッチ", { type: "DAILY" }, { logs: [{ targetDate: MONDAY, status: "SKIP" }] }),
        duty("日記", { type: "DAILY" }, { logs: done("2026-11-01") }),
      ],
      MONDAY,
    );
    expect(items).toEqual([{ name: "日記", section: "TODAY" }]);
  });

  it("SINCE_LAST は催促が発生しているものだけ「そろそろ」に入る", () => {
    const items = collectNotificationItems(
      [
        duty("お風呂", { type: "SINCE_LAST", days: 2 }, { logs: done("2026-10-31") }),
        duty("シーツ交換", { type: "SINCE_LAST", days: 7 }, { logs: done("2026-10-31") }),
        duty("爪切り", { type: "SINCE_LAST", days: 10 }),
      ],
      MONDAY,
    );
    expect(items).toEqual([
      { name: "お風呂", section: "SOON" },
      // DONE が1件もなければ作成直後から「そろそろ」
      { name: "爪切り", section: "SOON" },
    ]);
  });

  it("WEEKLY_COUNT は「残回数 ≥ 残り日数（今日を含む）」になってから入る", () => {
    const english = (logs: Log[] = []) =>
      duty("英語学習", { type: "WEEKLY_COUNT", timesPerWeek: 2 }, { logs });
    // 月曜: 残り2回・残り7日
    expect(collectNotificationItems([english()], MONDAY)).toEqual([]);
    // 土曜: 残り2回・残り2日
    expect(collectNotificationItems([english()], SATURDAY)).toEqual([
      { name: "英語学習", section: "THIS_WEEK", remaining: 2, weekEnd: SUNDAY },
    ]);
    // 土曜に1回済んでいれば、日曜は残り1回・残り1日
    expect(collectNotificationItems([english(done(SATURDAY))], SUNDAY)).toEqual([
      { name: "英語学習", section: "THIS_WEEK", remaining: 1, weekEnd: SUNDAY },
    ]);
    // 今週の目標を達成していれば入らない
    expect(collectNotificationItems([english(done(MONDAY, "2026-11-03"))], SUNDAY)).toEqual([]);
  });

  it("一時停止中・アーカイブ済みは入らない", () => {
    const items = collectNotificationItems(
      [
        duty(
          "プロテイン",
          { type: "DAILY" },
          { pauses: [{ startDate: "2026-10-30", endDate: null }] },
        ),
        duty("ジム", { type: "DAILY" }, { pauses: [{ startDate: "2026-10-20", endDate: MONDAY }] }),
        duty("日記", { type: "DAILY" }, { archivedAt: new Date("2026-11-01T10:00:00+09:00") }),
        duty(
          "お風呂",
          { type: "SINCE_LAST", days: 2 },
          { pauses: [{ startDate: "2026-11-01", endDate: null }] },
        ),
      ],
      MONDAY,
    );
    // 再開した日（endDate）からは通常どおり
    expect(items).toEqual([{ name: "ジム", section: "TODAY" }]);
  });

  it("「今日」「そろそろ」「今週」の順、セクション内は sortOrder 順", () => {
    const items = collectNotificationItems(
      [
        duty("英語学習", { type: "WEEKLY_COUNT", timesPerWeek: 3 }, { sortOrder: 0 }),
        duty("お風呂", { type: "SINCE_LAST", days: 1 }, { sortOrder: 1 }),
        duty("プロテイン", { type: "DAILY" }, { sortOrder: 3 }),
        duty("ゴミ出し", { type: "WEEKDAYS", weekdays: [6] }, { sortOrder: 2 }),
        duty("爪切り", { type: "SINCE_LAST", days: 10 }, { sortOrder: 0 }),
      ],
      SATURDAY,
    );
    expect(items.map((item) => item.name)).toEqual([
      "ゴミ出し",
      "プロテイン",
      "爪切り",
      "お風呂",
      "英語学習",
    ]);
  });
});

describe("summarizeWeek", () => {
  it("今週と先週の達成率を Duty ごとに合計する", () => {
    const summary = summarizeWeek(
      [
        // 今週 5/7、先週 3/7
        duty(
          "プロテイン",
          { type: "DAILY" },
          {
            logs: done(
              "2026-10-26",
              "2026-10-28",
              "2026-10-30",
              MONDAY,
              "2026-11-03",
              "2026-11-05",
              SATURDAY,
              SUNDAY,
            ),
          },
        ),
        // 今週 2/3、先週 3/3（4回済んでも目標回数で頭打ち）
        duty(
          "英語学習",
          { type: "WEEKLY_COUNT", timesPerWeek: 3 },
          {
            logs: done(
              "2026-10-26",
              "2026-10-27",
              "2026-10-28",
              "2026-10-29",
              "2026-11-04",
              SUNDAY,
            ),
          },
        ),
      ],
      SUNDAY,
    );
    expect(summary).toEqual({
      thisWeek: { done: 7, total: 10 },
      lastWeek: { done: 6, total: 10 },
    });
  });

  it("SINCE_LAST は週内の完了数に、週末時点で催促が続いていれば +1", () => {
    const bath = duty(
      "お風呂",
      { type: "SINCE_LAST", days: 2 },
      // 先週より前の DONE（10/24）が起点。先週は 10/27・10/30、今週は 11/3 のみ
      { logs: done("2026-10-24", "2026-10-27", "2026-10-30", "2026-11-03") },
    );
    expect(summarizeWeek([bath], SUNDAY)).toEqual({
      // 11/3 から5日空いて日曜も催促中
      thisWeek: { done: 1, total: 2 },
      // 10/30 から 11/1（日曜）で2日、週末時点で催促中
      lastWeek: { done: 2, total: 3 },
    });
  });

  it("Duty がなければ 0/0", () => {
    expect(summarizeWeek([], SUNDAY)).toEqual({
      thisWeek: { done: 0, total: 0 },
      lastWeek: { done: 0, total: 0 },
    });
  });
});
