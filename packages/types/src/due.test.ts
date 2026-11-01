import { describe, expect, it } from "vitest";
import type { DutyLog, DutyPause, WeekStart } from "./duty";
import type { ScheduleConfig } from "./schedule";
import {
  evaluateDutyOn,
  getNextDue,
  getSinceLastStatus,
  getWeeklyAchievement,
  getWeeklyCountStatus,
  isDueOn,
  isDutyActiveOn,
  isNotificationTarget,
  matchesFixedSchedule,
  type DutyDayEvaluation,
  type DutyScheduleInput,
  type FixedDueScheduleConfig,
} from "./due";

// カレンダーの確認用（月曜始まり）
//
// 2026年8月                 2026年2月（平年）         2028年2月（うるう年）
//  月 火 水 木 金 土 日       月 火 水 木 金 土 日      月 火 水 木 金 土 日
//                 1  2                         1        1  2  3  4  5  6
//   3  4  5  6  7  8  9       2  3  4  5  6  7  8    7  8  9 10 11 12 13
//  10 11 12 13 14 15 16       9 10 11 12 13 14 15   14 15 16 17 18 19 20
//  17 18 19 20 21 22 23      16 17 18 19 20 21 22   21 22 23 24 25 26 27
//  24 25 26 27 28 29 30      23 24 25 26 27 28      28 29
//  31
//
// 2026年9月: 9/1 は火曜、月曜は 7・14・21・28

type LogEntry = Pick<DutyLog, "targetDate" | "status">;
type PauseEntry = Pick<DutyPause, "startDate" | "endDate">;

const done = (...dates: string[]): LogEntry[] =>
  dates.map((targetDate) => ({ targetDate, status: "DONE" }));
const skip = (...dates: string[]): LogEntry[] =>
  dates.map((targetDate) => ({ targetDate, status: "SKIP" }));
const pause = (startDate: string, endDate: string | null): PauseEntry => ({ startDate, endDate });

/** 東京（UTC+9）でも UTC でも同じ日付になる時刻（日本時間の正午） */
const on = (date: string) => new Date(`${date}T03:00:00.000Z`);

/** 東京では 8/5 0:00、UTC では 8/4 15:00 */
const TOKYO_MIDNIGHT_0805 = new Date("2026-08-04T15:00:00.000Z");

interface MakeInputOptions {
  config: ScheduleConfig;
  createdAt?: Date;
  archivedAt?: Date | null;
  logs?: LogEntry[];
  pauses?: PauseEntry[];
  timeZone?: string;
  weekStart?: WeekStart;
}

/** 既定: 2026-01-01 作成・アーカイブなし・ログなし・一時停止なし・東京・月曜始まり */
function makeInput({
  config,
  createdAt = on("2026-01-01"),
  archivedAt = null,
  logs = [],
  pauses = [],
  timeZone = "Asia/Tokyo",
  weekStart = 1,
}: MakeInputOptions): DutyScheduleInput {
  return {
    duty: { scheduleConfig: config, createdAt, archivedAt },
    logs,
    pauses,
    timeZone,
    weekStart,
  };
}

const DAILY: FixedDueScheduleConfig = { type: "DAILY" };
const weekdays = (...days: number[]): FixedDueScheduleConfig => ({
  type: "WEEKDAYS",
  weekdays: days,
});
const biweekly = (anchor: string, ...days: number[]): FixedDueScheduleConfig => ({
  type: "NTH_WEEK",
  weekdays: days,
  every: 2,
  anchor,
});
const monthlyDay = (dayOfMonth: number): FixedDueScheduleConfig => ({
  type: "MONTHLY",
  dayOfMonth,
});
const monthlyNth = (nth: 1 | 2 | 3 | 4 | -1, weekday: number): FixedDueScheduleConfig => ({
  type: "MONTHLY",
  nth,
  weekday,
});
const weeklyCount = (timesPerWeek: number): ScheduleConfig => ({
  type: "WEEKLY_COUNT",
  timesPerWeek,
});
const sinceLast = (days: number): ScheduleConfig => ({ type: "SINCE_LAST", days });

// ---------------------------------------------------------------------------

describe("isDutyActiveOn", () => {
  it("作成日から有効、前日は無効", () => {
    const input = makeInput({ config: DAILY, createdAt: on("2026-08-05") });
    expect(isDutyActiveOn(input, "2026-08-04")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-05")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-06")).toBe(true);
  });

  it("アーカイブした日以降は無効、前日は有効", () => {
    const input = makeInput({ config: DAILY, archivedAt: on("2026-08-10") });
    expect(isDutyActiveOn(input, "2026-08-09")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-10")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-11")).toBe(false);
  });

  it("一時停止は開始日から停止、endDate 当日に再開", () => {
    const input = makeInput({ config: DAILY, pauses: [pause("2026-08-10", "2026-08-13")] });
    expect(isDutyActiveOn(input, "2026-08-09")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-10")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-12")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-13")).toBe(true);
  });

  it("endDate: null は開始日以降ずっと停止", () => {
    const input = makeInput({ config: DAILY, pauses: [pause("2026-08-10", null)] });
    expect(isDutyActiveOn(input, "2026-08-09")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-10")).toBe(false);
    expect(isDutyActiveOn(input, "2027-01-01")).toBe(false);
  });

  it("一時停止が複数あっても、それぞれの期間だけ停止", () => {
    const input = makeInput({
      config: DAILY,
      pauses: [pause("2026-08-03", "2026-08-05"), pause("2026-08-10", "2026-08-11")],
    });
    expect(isDutyActiveOn(input, "2026-08-04")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-05")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-09")).toBe(true);
    expect(isDutyActiveOn(input, "2026-08-10")).toBe(false);
    expect(isDutyActiveOn(input, "2026-08-11")).toBe(true);
  });

  it("status は見ない（PAUSED / ARCHIVED でも pauses・archivedAt がなければ有効）", () => {
    for (const status of ["PAUSED", "ARCHIVED"] as const) {
      const duty = { scheduleConfig: DAILY, createdAt: on("2026-01-01"), archivedAt: null, status };
      expect(isDutyActiveOn({ duty, pauses: [], timeZone: "Asia/Tokyo" }, "2026-08-05")).toBe(true);
    }
  });

  describe("タイムゾーン", () => {
    it("createdAt が東京の0時ちょうど: 東京では当日作成、UTC では前日作成", () => {
      const tokyo = makeInput({
        config: DAILY,
        createdAt: TOKYO_MIDNIGHT_0805,
        timeZone: "Asia/Tokyo",
      });
      expect(isDutyActiveOn(tokyo, "2026-08-04")).toBe(false);
      expect(isDutyActiveOn(tokyo, "2026-08-05")).toBe(true);

      const utc = makeInput({ config: DAILY, createdAt: TOKYO_MIDNIGHT_0805, timeZone: "UTC" });
      expect(isDutyActiveOn(utc, "2026-08-04")).toBe(true);
    });

    it("createdAt が東京の0時の直前なら、東京でも前日作成", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: new Date("2026-08-04T14:59:59.999Z"),
        timeZone: "Asia/Tokyo",
      });
      expect(isDutyActiveOn(input, "2026-08-04")).toBe(true);
    });

    it("archivedAt もタイムゾーンで日付にする", () => {
      // 東京では 8/10 0:00 にアーカイブ、UTC では 8/9 15:00 にアーカイブ
      const archivedAt = new Date("2026-08-09T15:00:00.000Z");
      const tokyo = makeInput({ config: DAILY, archivedAt, timeZone: "Asia/Tokyo" });
      expect(isDutyActiveOn(tokyo, "2026-08-09")).toBe(true);
      expect(isDutyActiveOn(tokyo, "2026-08-10")).toBe(false);

      const utc = makeInput({ config: DAILY, archivedAt, timeZone: "UTC" });
      expect(isDutyActiveOn(utc, "2026-08-08")).toBe(true);
      expect(isDutyActiveOn(utc, "2026-08-09")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe("matchesFixedSchedule", () => {
  it("DAILY は毎日", () => {
    for (const date of ["2026-08-01", "2026-08-02", "2026-08-05", "2028-02-29"]) {
      expect(matchesFixedSchedule(DAILY, date, 1)).toBe(true);
    }
  });

  it("WEEKDAYS は指定した曜日だけ（複数可）", () => {
    const config = weekdays(2, 5); // 火・金
    expect(matchesFixedSchedule(config, "2026-08-04", 1)).toBe(true); // 火
    expect(matchesFixedSchedule(config, "2026-08-07", 1)).toBe(true); // 金
    expect(matchesFixedSchedule(config, "2026-08-05", 1)).toBe(false); // 水
    expect(matchesFixedSchedule(config, "2026-08-08", 1)).toBe(false); // 土
    expect(matchesFixedSchedule(weekdays(0), "2026-08-09", 1)).toBe(true); // 日
    expect(matchesFixedSchedule(weekdays(0), "2026-08-10", 1)).toBe(false); // 月
  });

  describe("MONTHLY 日付指定", () => {
    it("該当日だけ", () => {
      expect(matchesFixedSchedule(monthlyDay(27), "2026-08-27", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(27), "2026-08-26", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(27), "2026-08-28", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(1), "2026-03-01", 1)).toBe(true);
    });

    it("31日指定: 31日がある月は31日だけ（30日には丸めない）", () => {
      expect(matchesFixedSchedule(monthlyDay(31), "2026-08-31", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-08-30", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-01-31", 1)).toBe(true);
    });

    it("31日指定: 30日の月は30日に丸める", () => {
      expect(matchesFixedSchedule(monthlyDay(31), "2026-04-30", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-04-29", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-09-30", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-10-01", 1)).toBe(false);
    });

    it("31日指定: 2月は平年28日・うるう年29日に丸める", () => {
      expect(matchesFixedSchedule(monthlyDay(31), "2026-02-28", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-02-27", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(31), "2026-03-01", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(31), "2028-02-29", 1)).toBe(true);
      // うるう年の2月28日は月末ではないので当たらない
      expect(matchesFixedSchedule(monthlyDay(31), "2028-02-28", 1)).toBe(false);
    });

    it("30日指定: 2月は月末に丸め、31日の月は30日のまま", () => {
      expect(matchesFixedSchedule(monthlyDay(30), "2026-02-28", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(30), "2028-02-29", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(30), "2028-02-28", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(30), "2026-04-30", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(30), "2026-08-30", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(30), "2026-08-31", 1)).toBe(false);
    });

    it("29日指定: 平年の2月だけ28日に丸める", () => {
      expect(matchesFixedSchedule(monthlyDay(29), "2026-02-28", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(29), "2026-02-27", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(29), "2028-02-29", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(29), "2028-02-28", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyDay(29), "2026-03-29", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(29), "2026-03-28", 1)).toBe(false);
    });

    it("28日指定はうるう年でも28日（29日には当たらない）", () => {
      expect(matchesFixedSchedule(monthlyDay(28), "2028-02-28", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyDay(28), "2028-02-29", 1)).toBe(false);
    });
  });

  describe("MONTHLY 第N曜日", () => {
    it("第1〜4月曜（2026年8月の月曜は 3・10・17・24・31）", () => {
      expect(matchesFixedSchedule(monthlyNth(1, 1), "2026-08-03", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(1, 1), "2026-08-10", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyNth(2, 1), "2026-08-10", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(3, 1), "2026-08-17", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(4, 1), "2026-08-24", 1)).toBe(true);
    });

    it("第5週の日は第4ではない", () => {
      expect(matchesFixedSchedule(monthlyNth(4, 1), "2026-08-31", 1)).toBe(false);
    });

    it("曜日が違えば当たらない", () => {
      expect(matchesFixedSchedule(monthlyNth(1, 1), "2026-08-04", 1)).toBe(false);
    });

    it("最終（-1）は月の最後のその曜日", () => {
      expect(matchesFixedSchedule(monthlyNth(-1, 1), "2026-08-31", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(-1, 1), "2026-08-24", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyNth(-1, 0), "2026-08-30", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(-1, 0), "2026-08-23", 1)).toBe(false);
    });

    it("その曜日が4回しかない月は、最終と第4が同じ日", () => {
      // 2026年2月の土曜は 7・14・21・28
      expect(matchesFixedSchedule(monthlyNth(-1, 6), "2026-02-28", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(4, 6), "2026-02-28", 1)).toBe(true);
    });

    it("月初が該当曜日なら1日が第1", () => {
      expect(matchesFixedSchedule(monthlyNth(1, 0), "2026-02-01", 1)).toBe(true); // 日
      expect(matchesFixedSchedule(monthlyNth(1, 0), "2026-02-08", 1)).toBe(false);
    });

    it("うるう年の2月29日（2028年2月の火曜は 1・8・15・22・29）", () => {
      expect(matchesFixedSchedule(monthlyNth(-1, 2), "2028-02-29", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(4, 2), "2028-02-22", 1)).toBe(true);
      expect(matchesFixedSchedule(monthlyNth(4, 2), "2028-02-29", 1)).toBe(false);
      expect(matchesFixedSchedule(monthlyNth(-1, 2), "2028-02-22", 1)).toBe(false);
    });
  });

  describe("NTH_WEEK（隔週）", () => {
    const config = biweekly("2026-08-05", 3); // 水曜、アンカー 8/5（水）

    it("アンカー当日は当たる", () => {
      expect(matchesFixedSchedule(config, "2026-08-05", 1)).toBe(true);
    });

    it("ちょうど1週後は当たらず、2週後は当たる", () => {
      expect(matchesFixedSchedule(config, "2026-08-12", 1)).toBe(false);
      expect(matchesFixedSchedule(config, "2026-08-19", 1)).toBe(true);
      expect(matchesFixedSchedule(config, "2026-08-26", 1)).toBe(false);
      expect(matchesFixedSchedule(config, "2026-09-02", 1)).toBe(true);
    });

    it("1年後も偶数週なら当たる（52週後は当たり、53週後は当たらない）", () => {
      expect(matchesFixedSchedule(config, "2027-08-04", 1)).toBe(true);
      expect(matchesFixedSchedule(config, "2027-08-11", 1)).toBe(false);
    });

    it("指定曜日以外は当たらない", () => {
      expect(matchesFixedSchedule(config, "2026-08-06", 1)).toBe(false);
      expect(matchesFixedSchedule(config, "2026-08-18", 1)).toBe(false);
    });

    it("アンカーより前の日は、偶数週前でも当たらない", () => {
      expect(matchesFixedSchedule(config, "2026-07-22", 1)).toBe(false); // 2週前
      expect(matchesFixedSchedule(config, "2026-07-29", 1)).toBe(false); // 1週前
    });

    it("複数曜日: アンカーと同じ週でもアンカーより前の曜日は当たらない", () => {
      const multi = biweekly("2026-08-05", 1, 3); // 月・水、アンカー 8/5（水）
      expect(matchesFixedSchedule(multi, "2026-08-03", 1)).toBe(false); // アンカー週の月曜（アンカーより前）
      expect(matchesFixedSchedule(multi, "2026-08-05", 1)).toBe(true);
      expect(matchesFixedSchedule(multi, "2026-08-10", 1)).toBe(false); // 2週目
      expect(matchesFixedSchedule(multi, "2026-08-12", 1)).toBe(false);
      expect(matchesFixedSchedule(multi, "2026-08-17", 1)).toBe(true); // 3週目
      expect(matchesFixedSchedule(multi, "2026-08-19", 1)).toBe(true);
      expect(matchesFixedSchedule(multi, "2026-08-18", 1)).toBe(false); // 火曜
    });

    it("週の始まりで「アンカーを含む週」が変わる", () => {
      // 日曜指定、アンカー 8/5（水）
      const sunday = biweekly("2026-08-05", 0);

      // 月曜始まり: アンカー週は 8/3〜8/9。8/9（日）は1週目、8/16 は2週目、8/23 は3週目
      expect(matchesFixedSchedule(sunday, "2026-08-02", 1)).toBe(false);
      expect(matchesFixedSchedule(sunday, "2026-08-09", 1)).toBe(true);
      expect(matchesFixedSchedule(sunday, "2026-08-16", 1)).toBe(false);
      expect(matchesFixedSchedule(sunday, "2026-08-23", 1)).toBe(true);

      // 日曜始まり: アンカー週は 8/2〜8/8。8/2（日）はアンカーより前、8/9 は2週目、8/16 は3週目
      expect(matchesFixedSchedule(sunday, "2026-08-02", 0)).toBe(false);
      expect(matchesFixedSchedule(sunday, "2026-08-09", 0)).toBe(false);
      expect(matchesFixedSchedule(sunday, "2026-08-16", 0)).toBe(true);
      expect(matchesFixedSchedule(sunday, "2026-08-23", 0)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe("isDueOn", () => {
  it("期日確定型: ルールに当たる有効日だけ期日", () => {
    const input = makeInput({ config: weekdays(2, 5) });
    expect(isDueOn(input, "2026-08-04")).toBe(true);
    expect(isDueOn(input, "2026-08-05")).toBe(false);
  });

  it("作成日より前は期日にならない", () => {
    const input = makeInput({ config: DAILY, createdAt: on("2026-08-05") });
    expect(isDueOn(input, "2026-08-04")).toBe(false);
    expect(isDueOn(input, "2026-08-05")).toBe(true);
  });

  it("アーカイブした日以降は期日にならない", () => {
    const input = makeInput({ config: DAILY, archivedAt: on("2026-08-10") });
    expect(isDueOn(input, "2026-08-09")).toBe(true);
    expect(isDueOn(input, "2026-08-10")).toBe(false);
  });

  it("一時停止期間は期日にならず、endDate 当日から戻る", () => {
    const input = makeInput({ config: DAILY, pauses: [pause("2026-08-05", "2026-08-07")] });
    expect(isDueOn(input, "2026-08-04")).toBe(true);
    expect(isDueOn(input, "2026-08-05")).toBe(false);
    expect(isDueOn(input, "2026-08-06")).toBe(false);
    expect(isDueOn(input, "2026-08-07")).toBe(true);
  });

  it("取りこぼしは翌日に持ち越さない", () => {
    // 火曜に未記録でも、水曜は期日にならない
    const input = makeInput({ config: weekdays(2) });
    expect(isDueOn(input, "2026-08-05")).toBe(false);
  });

  it("当日のログがあっても期日のまま", () => {
    expect(isDueOn(makeInput({ config: DAILY, logs: done("2026-08-05") }), "2026-08-05")).toBe(
      true,
    );
    expect(isDueOn(makeInput({ config: DAILY, logs: skip("2026-08-05") }), "2026-08-05")).toBe(
      true,
    );
  });

  it("NTH_WEEK: アンカーより後に作成した場合、作成前の当たり日は期日にならない", () => {
    const input = makeInput({ config: biweekly("2026-08-05", 3), createdAt: on("2026-08-10") });
    expect(isDueOn(input, "2026-08-05")).toBe(false);
    expect(isDueOn(input, "2026-08-19")).toBe(true);
  });

  it("期日不確定型は常に false（催促中・残回数ありでも）", () => {
    expect(isDueOn(makeInput({ config: sinceLast(2) }), "2026-08-05")).toBe(false);
    expect(isDueOn(makeInput({ config: weeklyCount(7) }), "2026-08-05")).toBe(false);
  });

  it("作成日はタイムゾーンで決まる", () => {
    const tokyo = makeInput({
      config: DAILY,
      createdAt: TOKYO_MIDNIGHT_0805,
      timeZone: "Asia/Tokyo",
    });
    const utc = makeInput({ config: DAILY, createdAt: TOKYO_MIDNIGHT_0805, timeZone: "UTC" });
    expect(isDueOn(tokyo, "2026-08-04")).toBe(false);
    expect(isDueOn(utc, "2026-08-04")).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("getSinceLastStatus", () => {
  const base = { config: sinceLast(2), createdAt: on("2026-08-01") };

  it("SINCE_LAST 以外は null", () => {
    expect(getSinceLastStatus(makeInput({ config: DAILY }), "2026-08-05")).toBeNull();
    expect(getSinceLastStatus(makeInput({ config: weeklyCount(3) }), "2026-08-05")).toBeNull();
  });

  it("初回: DONE が1件もなければ作成日から催促", () => {
    const input = makeInput(base);
    expect(getSinceLastStatus(input, "2026-08-01")).toEqual({
      overdue: true,
      daysSinceLastDone: null,
    });
    expect(getSinceLastStatus(input, "2026-08-20")).toEqual({
      overdue: true,
      daysSinceLastDone: null,
    });
  });

  it("作成日より前は催促しない", () => {
    const input = makeInput(base);
    expect(getSinceLastStatus(input, "2026-07-31")).toMatchObject({ overdue: false });
  });

  it("days 日目ちょうどから催促、その前日は催促しない", () => {
    const input = makeInput({ ...base, logs: done("2026-08-03") });
    expect(getSinceLastStatus(input, "2026-08-04")).toEqual({
      overdue: false,
      daysSinceLastDone: 1,
    });
    expect(getSinceLastStatus(input, "2026-08-05")).toEqual({
      overdue: true,
      daysSinceLastDone: 2,
    });
    expect(getSinceLastStatus(input, "2026-08-06")).toEqual({
      overdue: true,
      daysSinceLastDone: 3,
    });
  });

  it("当日の DONE は当日の判定に影響しない", () => {
    // 初回の DONE を当日につけても、その日は「DONE なし」として催促が発生していた扱い
    const first = makeInput({ ...base, logs: done("2026-08-03") });
    expect(getSinceLastStatus(first, "2026-08-03")).toEqual({
      overdue: true,
      daysSinceLastDone: null,
    });

    // 催促中の日に DONE しても、その日の overdue は true のまま
    const again = makeInput({ ...base, logs: done("2026-08-03", "2026-08-05") });
    expect(getSinceLastStatus(again, "2026-08-05")).toEqual({
      overdue: true,
      daysSinceLastDone: 2,
    });
    // 翌日からは新しい DONE が起点
    expect(getSinceLastStatus(again, "2026-08-06")).toEqual({
      overdue: false,
      daysSinceLastDone: 1,
    });
  });

  it("SKIP は起点にならない", () => {
    const input = makeInput({ ...base, logs: [...done("2026-08-03"), ...skip("2026-08-04")] });
    expect(getSinceLastStatus(input, "2026-08-05")).toEqual({
      overdue: true,
      daysSinceLastDone: 2,
    });

    const onlySkip = makeInput({ ...base, logs: skip("2026-08-03") });
    expect(getSinceLastStatus(onlySkip, "2026-08-04")).toEqual({
      overdue: true,
      daysSinceLastDone: null,
    });
  });

  it("date より後の DONE は見ない", () => {
    const input = makeInput({ ...base, logs: done("2026-08-03", "2026-08-10") });
    expect(getSinceLastStatus(input, "2026-08-05")).toEqual({
      overdue: true,
      daysSinceLastDone: 2,
    });
  });

  it("最新の DONE を起点にする（ログの並び順に依存しない）", () => {
    const input = makeInput({ ...base, logs: done("2026-08-06", "2026-08-03") });
    expect(getSinceLastStatus(input, "2026-08-07")).toEqual({
      overdue: false,
      daysSinceLastDone: 1,
    });
    expect(getSinceLastStatus(input, "2026-08-08")).toEqual({
      overdue: true,
      daysSinceLastDone: 2,
    });
  });

  it("days = 1 なら DONE の翌日から催促", () => {
    const input = makeInput({ ...base, config: sinceLast(1), logs: done("2026-08-03") });
    expect(getSinceLastStatus(input, "2026-08-04")).toEqual({
      overdue: true,
      daysSinceLastDone: 1,
    });
  });

  it("一時停止中は催促しない。再開日には催促が戻る", () => {
    const input = makeInput({
      ...base,
      logs: done("2026-08-03"),
      pauses: [pause("2026-08-04", "2026-08-08")],
    });
    expect(getSinceLastStatus(input, "2026-08-05")).toMatchObject({ overdue: false });
    expect(getSinceLastStatus(input, "2026-08-08")).toEqual({
      overdue: true,
      daysSinceLastDone: 5,
    });
  });

  it("一時停止中の日に付いた DONE も起点になる（SPEC.md）", () => {
    const input = makeInput({
      ...base,
      config: sinceLast(3),
      logs: done("2026-08-03", "2026-08-06"),
      pauses: [pause("2026-08-04", "2026-08-08")],
    });
    expect(getSinceLastStatus(input, "2026-08-08")).toEqual({
      overdue: false,
      daysSinceLastDone: 2,
    });
  });

  it("アーカイブした日以降は催促しない", () => {
    const input = makeInput({ ...base, archivedAt: on("2026-08-10") });
    expect(getSinceLastStatus(input, "2026-08-09")).toMatchObject({ overdue: true });
    expect(getSinceLastStatus(input, "2026-08-10")).toMatchObject({ overdue: false });
  });

  it("作成日はタイムゾーンで決まる", () => {
    const tokyo = makeInput({
      config: sinceLast(2),
      createdAt: TOKYO_MIDNIGHT_0805,
      timeZone: "Asia/Tokyo",
    });
    expect(getSinceLastStatus(tokyo, "2026-08-04")).toMatchObject({ overdue: false });
    expect(getSinceLastStatus(tokyo, "2026-08-05")).toMatchObject({ overdue: true });

    const utc = makeInput({
      config: sinceLast(2),
      createdAt: TOKYO_MIDNIGHT_0805,
      timeZone: "UTC",
    });
    expect(getSinceLastStatus(utc, "2026-08-04")).toMatchObject({ overdue: true });
  });
});

// ---------------------------------------------------------------------------

describe("getWeeklyCountStatus", () => {
  const created = on("2026-07-01");

  it("WEEKLY_COUNT 以外は null", () => {
    expect(getWeeklyCountStatus(makeInput({ config: DAILY }), "2026-08-05")).toBeNull();
    expect(getWeeklyCountStatus(makeInput({ config: sinceLast(2) }), "2026-08-05")).toBeNull();
  });

  it("週の範囲・目標・済んだ数・残回数・残り日数", () => {
    const input = makeInput({
      config: weeklyCount(3),
      createdAt: created,
      logs: done("2026-08-03", "2026-08-04"),
    });
    expect(getWeeklyCountStatus(input, "2026-08-05")).toEqual({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      target: 3,
      doneCount: 2,
      remaining: 1,
      remainingDays: 5,
      shouldNotify: false,
    });
  });

  it("date 当日の DONE は doneCount に含めない", () => {
    const input = makeInput({
      config: weeklyCount(3),
      createdAt: created,
      logs: done("2026-08-03", "2026-08-04", "2026-08-05"),
    });
    expect(getWeeklyCountStatus(input, "2026-08-05")).toMatchObject({ doneCount: 2, remaining: 1 });
  });

  it("前の週の DONE・SKIP は数えない", () => {
    const input = makeInput({
      config: weeklyCount(3),
      createdAt: created,
      logs: [...done("2026-08-02"), ...skip("2026-08-03")],
    });
    expect(getWeeklyCountStatus(input, "2026-08-05")).toMatchObject({ doneCount: 0, remaining: 3 });
  });

  it("残回数は 0 で下限（目標を超えて済ませても負にならない）", () => {
    const input = makeInput({
      config: weeklyCount(2),
      createdAt: created,
      logs: done("2026-08-03", "2026-08-04", "2026-08-05"),
    });
    expect(getWeeklyCountStatus(input, "2026-08-08")).toMatchObject({
      doneCount: 3,
      remaining: 0,
      shouldNotify: false,
    });
  });

  describe("通知に組み込むか（残回数 ≥ 残り日数）", () => {
    it("残回数 = 残り日数なら含める", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created });
      // 金曜: 残り日数 3（金土日）、残回数 3
      expect(getWeeklyCountStatus(input, "2026-08-07")).toMatchObject({
        remaining: 3,
        remainingDays: 3,
        shouldNotify: true,
      });
    });

    it("残回数 < 残り日数なら含めない", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created });
      // 木曜: 残り日数 4、残回数 3
      expect(getWeeklyCountStatus(input, "2026-08-06")).toMatchObject({
        remaining: 3,
        remainingDays: 4,
        shouldNotify: false,
      });
    });

    it("残回数 > 残り日数（もう達成できない）でも含める", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created });
      expect(getWeeklyCountStatus(input, "2026-08-08")).toMatchObject({
        remaining: 3,
        remainingDays: 2,
        shouldNotify: true,
      });
      expect(getWeeklyCountStatus(input, "2026-08-09")).toMatchObject({
        remaining: 3,
        remainingDays: 1,
        shouldNotify: true,
      });
    });

    it("週末当日に残り1回なら含め、前日（残り2日）なら含めない", () => {
      const input = makeInput({
        config: weeklyCount(2),
        createdAt: created,
        logs: done("2026-08-03"),
      });
      expect(getWeeklyCountStatus(input, "2026-08-08")).toMatchObject({
        remaining: 1,
        remainingDays: 2,
        shouldNotify: false,
      });
      expect(getWeeklyCountStatus(input, "2026-08-09")).toMatchObject({
        remaining: 1,
        remainingDays: 1,
        shouldNotify: true,
      });
    });

    it("残回数 0 なら含めない", () => {
      const input = makeInput({
        config: weeklyCount(1),
        createdAt: created,
        logs: done("2026-08-03"),
      });
      expect(getWeeklyCountStatus(input, "2026-08-09")).toMatchObject({
        remaining: 0,
        shouldNotify: false,
      });
    });

    it("作成日より前の日は含めない", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-09") });
      expect(getWeeklyCountStatus(input, "2026-08-08")).toMatchObject({ shouldNotify: false });
    });
  });

  describe("週の始まり", () => {
    const logs = done("2026-08-08", "2026-08-09"); // 土・日

    it("月曜始まり: 日曜は週末、月曜から新しい週", () => {
      const input = makeInput({ config: weeklyCount(2), createdAt: created, logs, weekStart: 1 });
      expect(getWeeklyCountStatus(input, "2026-08-09")).toEqual({
        weekStart: "2026-08-03",
        weekEnd: "2026-08-09",
        target: 2,
        doneCount: 1,
        remaining: 1,
        remainingDays: 1,
        shouldNotify: true,
      });
      expect(getWeeklyCountStatus(input, "2026-08-10")).toEqual({
        weekStart: "2026-08-10",
        weekEnd: "2026-08-16",
        target: 2,
        doneCount: 0,
        remaining: 2,
        remainingDays: 7,
        shouldNotify: false,
      });
    });

    it("日曜始まり: 日曜から新しい週、月曜は日曜の DONE を数える", () => {
      const input = makeInput({ config: weeklyCount(2), createdAt: created, logs, weekStart: 0 });
      expect(getWeeklyCountStatus(input, "2026-08-08")).toMatchObject({
        weekStart: "2026-08-02",
        weekEnd: "2026-08-08",
        doneCount: 0,
        remaining: 2,
        remainingDays: 1,
        shouldNotify: true,
      });
      expect(getWeeklyCountStatus(input, "2026-08-09")).toEqual({
        weekStart: "2026-08-09",
        weekEnd: "2026-08-15",
        target: 2,
        doneCount: 0,
        remaining: 2,
        remainingDays: 7,
        shouldNotify: false,
      });
      expect(getWeeklyCountStatus(input, "2026-08-10")).toEqual({
        weekStart: "2026-08-09",
        weekEnd: "2026-08-15",
        target: 2,
        doneCount: 1,
        remaining: 1,
        remainingDays: 6,
        shouldNotify: false,
      });
    });
  });

  describe("週の途中で作った週", () => {
    it("目標は min(timesPerWeek, 作成日から週末までの日数)", () => {
      // 金曜作成: 金土日の3日 → min(3, 3) = 3
      const fri = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-07") });
      expect(getWeeklyCountStatus(fri, "2026-08-07")).toMatchObject({ target: 3 });

      // 土曜作成: 土日の2日 → min(3, 2) = 2
      const sat = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-08") });
      expect(getWeeklyCountStatus(sat, "2026-08-08")).toEqual({
        weekStart: "2026-08-03",
        weekEnd: "2026-08-09",
        target: 2,
        doneCount: 0,
        remaining: 2,
        remainingDays: 2,
        shouldNotify: true,
      });

      // 木曜作成・週5回: 木金土日の4日 → 4
      const thu = makeInput({ config: weeklyCount(5), createdAt: on("2026-08-06") });
      expect(getWeeklyCountStatus(thu, "2026-08-06")).toMatchObject({ target: 4 });
    });

    it("週初の作成なら通常の timesPerWeek", () => {
      const mon = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-03") });
      expect(getWeeklyCountStatus(mon, "2026-08-03")).toMatchObject({ target: 3 });
    });

    it("週末当日の作成なら目標 1", () => {
      const sun = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-09") });
      expect(getWeeklyCountStatus(sun, "2026-08-09")).toMatchObject({
        target: 1,
        remaining: 1,
        remainingDays: 1,
        shouldNotify: true,
      });
    });

    it("作成翌週は通常の timesPerWeek", () => {
      const sun = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-09") });
      expect(getWeeklyCountStatus(sun, "2026-08-10")).toMatchObject({ target: 3 });
    });

    it("週の始まりで作成週の日数が変わる", () => {
      // 日曜作成: 月曜始まりなら週末当日（1日）、日曜始まりなら週初（7日）
      expect(
        getWeeklyCountStatus(
          makeInput({ config: weeklyCount(3), createdAt: on("2026-08-09"), weekStart: 0 }),
          "2026-08-09",
        ),
      ).toMatchObject({ target: 3 });
      // 土曜作成: 月曜始まりなら2日、日曜始まりなら週末当日（1日）
      expect(
        getWeeklyCountStatus(
          makeInput({ config: weeklyCount(3), createdAt: on("2026-08-08"), weekStart: 0 }),
          "2026-08-08",
        ),
      ).toMatchObject({ target: 1 });
    });

    it("作成日はタイムゾーンで決まる", () => {
      // 2026-08-08T15:00Z は東京で 8/9（日）0:00、UTC では 8/8（土）
      const createdAt = new Date("2026-08-08T15:00:00.000Z");
      const tokyo = makeInput({ config: weeklyCount(3), createdAt, timeZone: "Asia/Tokyo" });
      const utc = makeInput({ config: weeklyCount(3), createdAt, timeZone: "UTC" });
      expect(getWeeklyCountStatus(tokyo, "2026-08-09")).toMatchObject({ target: 1 });
      expect(getWeeklyCountStatus(utc, "2026-08-09")).toMatchObject({ target: 2 });
    });
  });

  describe("一時停止・アーカイブで欠けた週", () => {
    // 8/5〜8/7 が一時停止（8/8 再開）→ 有効日は 3・4・8・9 の4日
    const pauses = [pause("2026-08-05", "2026-08-08")];

    it("目標は有効日数で頭打ち、停止中の日の DONE は数えない", () => {
      const input = makeInput({
        config: weeklyCount(5),
        createdAt: created,
        pauses,
        logs: done("2026-08-04", "2026-08-05", "2026-08-06"),
      });
      expect(getWeeklyCountStatus(input, "2026-08-08")).toEqual({
        weekStart: "2026-08-03",
        weekEnd: "2026-08-09",
        target: 4,
        doneCount: 1,
        remaining: 3,
        remainingDays: 2,
        shouldNotify: true,
      });
    });

    it("一時停止中の日は通知に含めない", () => {
      const input = makeInput({
        config: weeklyCount(5),
        createdAt: created,
        pauses,
        logs: done("2026-08-04"),
      });
      expect(getWeeklyCountStatus(input, "2026-08-06")).toMatchObject({
        target: 4,
        doneCount: 1,
        remaining: 3,
        remainingDays: 4,
        shouldNotify: false,
      });
    });

    it("endDate: null の一時停止は、それ以降の日を有効日数から除く", () => {
      const input = makeInput({
        config: weeklyCount(5),
        createdAt: created,
        pauses: [pause("2026-08-06", null)],
      });
      expect(getWeeklyCountStatus(input, "2026-08-05")).toMatchObject({ target: 3 });
    });

    it("アーカイブした日以降を有効日数から除く", () => {
      const input = makeInput({
        config: weeklyCount(5),
        createdAt: created,
        archivedAt: on("2026-08-06"),
      });
      expect(getWeeklyCountStatus(input, "2026-08-05")).toMatchObject({ target: 3 });
    });

    it("有効日数が timesPerWeek 以上なら timesPerWeek のまま", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created, pauses });
      expect(getWeeklyCountStatus(input, "2026-08-03")).toMatchObject({ target: 3 });
    });
  });
});

// ---------------------------------------------------------------------------

describe("evaluateDutyOn", () => {
  describe("期日確定型", () => {
    it("期日なら TODAY", () => {
      expect(evaluateDutyOn(makeInput({ config: DAILY }), "2026-08-05")).toEqual({
        section: "TODAY",
        log: null,
      });
    });

    it("当日に済ませても TODAY のまま log が DONE", () => {
      const input = makeInput({ config: DAILY, logs: done("2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({ section: "TODAY", log: "DONE" });
    });

    it("スキップなら log が SKIP", () => {
      const input = makeInput({ config: DAILY, logs: skip("2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({ section: "TODAY", log: "SKIP" });
    });

    it("期日でなければ section は null、ログがあれば log は返す", () => {
      expect(evaluateDutyOn(makeInput({ config: weekdays(2) }), "2026-08-05")).toEqual({
        section: null,
        log: null,
      });
      const input = makeInput({ config: weekdays(2), logs: done("2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({ section: null, log: "DONE" });
    });

    it("作成前・一時停止中・アーカイブ後は section が null", () => {
      expect(
        evaluateDutyOn(makeInput({ config: DAILY, createdAt: on("2026-08-06") }), "2026-08-05"),
      ).toEqual({
        section: null,
        log: null,
      });
      expect(
        evaluateDutyOn(
          makeInput({ config: DAILY, pauses: [pause("2026-08-05", null)] }),
          "2026-08-05",
        ),
      ).toEqual({ section: null, log: null });
      expect(
        evaluateDutyOn(makeInput({ config: DAILY, archivedAt: on("2026-08-05") }), "2026-08-05"),
      ).toEqual({
        section: null,
        log: null,
      });
    });

    it("他のログは当日の log に影響しない", () => {
      const input = makeInput({ config: DAILY, logs: done("2026-08-04", "2026-08-06") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({ section: "TODAY", log: null });
    });
  });

  describe("SINCE_LAST", () => {
    const base = { config: sinceLast(2), createdAt: on("2026-08-01") };

    it("催促が発生していれば SOON（SinceLastStatus を同梱）", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({
        section: "SOON",
        log: null,
        overdue: true,
        daysSinceLastDone: 2,
      });
    });

    it("初回（DONE なし）は作成日から SOON", () => {
      expect(evaluateDutyOn(makeInput(base), "2026-08-01")).toEqual({
        section: "SOON",
        log: null,
        overdue: true,
        daysSinceLastDone: null,
      });
    });

    it("催促がなければ section は null", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03") });
      expect(evaluateDutyOn(input, "2026-08-04")).toEqual({ section: null, log: null });
    });

    it("当日に済ませても SOON のまま log が DONE、翌日は消える", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03", "2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({
        section: "SOON",
        log: "DONE",
        overdue: true,
        daysSinceLastDone: 2,
      });
      expect(evaluateDutyOn(input, "2026-08-06")).toEqual({ section: null, log: null });
    });

    it("スキップしても起点にならず、翌日も SOON", () => {
      const input = makeInput({ ...base, logs: [...done("2026-08-03"), ...skip("2026-08-05")] });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({
        section: "SOON",
        log: "SKIP",
        overdue: true,
        daysSinceLastDone: 2,
      });
      expect(evaluateDutyOn(input, "2026-08-06")).toEqual({
        section: "SOON",
        log: null,
        overdue: true,
        daysSinceLastDone: 3,
      });
    });

    it("作成前・一時停止中は section が null", () => {
      expect(evaluateDutyOn(makeInput(base), "2026-07-31")).toEqual({ section: null, log: null });
      const paused = makeInput({ ...base, pauses: [pause("2026-08-05", "2026-08-07")] });
      expect(evaluateDutyOn(paused, "2026-08-05")).toEqual({ section: null, log: null });
    });
  });

  describe("WEEKLY_COUNT", () => {
    const base = { config: weeklyCount(2), createdAt: on("2026-07-01") };

    it("残回数があれば THIS_WEEK（WeeklyCountStatus を同梱）", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03") });
      expect(evaluateDutyOn(input, "2026-08-08")).toEqual({
        section: "THIS_WEEK",
        log: null,
        weekStart: "2026-08-03",
        weekEnd: "2026-08-09",
        target: 2,
        doneCount: 1,
        remaining: 1,
        remainingDays: 2,
        shouldNotify: false,
      });
    });

    it("当日に済ませても THIS_WEEK のまま log が DONE（当日の DONE は残回数に含めない）", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03", "2026-08-09") });
      expect(evaluateDutyOn(input, "2026-08-09")).toEqual({
        section: "THIS_WEEK",
        log: "DONE",
        weekStart: "2026-08-03",
        weekEnd: "2026-08-09",
        target: 2,
        doneCount: 1,
        remaining: 1,
        remainingDays: 1,
        shouldNotify: true,
      });
    });

    it("残回数 0 なら section は null", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03", "2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-08")).toEqual({ section: null, log: null });
    });

    it("週が変われば残回数は戻る", () => {
      const input = makeInput({ ...base, logs: done("2026-08-03", "2026-08-05") });
      expect(evaluateDutyOn(input, "2026-08-10")).toMatchObject({
        section: "THIS_WEEK",
        log: null,
        weekStart: "2026-08-10",
        doneCount: 0,
        remaining: 2,
      });
    });

    it("一時停止中は section が null", () => {
      const input = makeInput({ ...base, pauses: [pause("2026-08-05", "2026-08-07")] });
      expect(evaluateDutyOn(input, "2026-08-05")).toEqual({ section: null, log: null });
    });
  });
});

// ---------------------------------------------------------------------------

describe("isNotificationTarget", () => {
  const weekly = {
    weekStart: "2026-08-03",
    weekEnd: "2026-08-09",
    target: 2,
    doneCount: 1,
    remaining: 1,
    remainingDays: 1,
  };

  it("section が null なら含めない", () => {
    expect(isNotificationTarget({ section: null, log: null })).toBe(false);
  });

  it("TODAY は未記録なら含め、済・スキップなら除く", () => {
    expect(isNotificationTarget({ section: "TODAY", log: null })).toBe(true);
    expect(isNotificationTarget({ section: "TODAY", log: "DONE" })).toBe(false);
    expect(isNotificationTarget({ section: "TODAY", log: "SKIP" })).toBe(false);
  });

  it("SOON は未記録なら含め、済・スキップなら除く", () => {
    const soon = { section: "SOON", overdue: true, daysSinceLastDone: 3 } as const;
    expect(isNotificationTarget({ ...soon, log: null })).toBe(true);
    expect(isNotificationTarget({ ...soon, log: "DONE" })).toBe(false);
    expect(isNotificationTarget({ ...soon, log: "SKIP" })).toBe(false);
  });

  it("THIS_WEEK は shouldNotify のものだけ。済・スキップなら除く", () => {
    const yes: DutyDayEvaluation = {
      section: "THIS_WEEK",
      log: null,
      ...weekly,
      shouldNotify: true,
    };
    const no: DutyDayEvaluation = {
      section: "THIS_WEEK",
      log: null,
      ...weekly,
      remainingDays: 3,
      shouldNotify: false,
    };
    expect(isNotificationTarget(yes)).toBe(true);
    expect(isNotificationTarget(no)).toBe(false);
    expect(isNotificationTarget({ ...yes, log: "DONE" })).toBe(false);
    expect(isNotificationTarget({ ...yes, log: "SKIP" })).toBe(false);
  });

  describe("evaluateDutyOn と組み合わせて", () => {
    const created = on("2026-07-01");

    it("WEEKLY_COUNT: 残回数 = 残り日数なら含める", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-07"))).toBe(true);
    });

    it("WEEKLY_COUNT: 残回数 < 残り日数なら含めない", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: created });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-06"))).toBe(false);
    });

    it("WEEKLY_COUNT: 残回数 0 なら含めない", () => {
      const input = makeInput({
        config: weeklyCount(1),
        createdAt: created,
        logs: done("2026-08-03"),
      });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-09"))).toBe(false);
    });

    it("SINCE_LAST: 催促中なら含め、催促がなければ含めない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-03"),
      });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-04"))).toBe(false);
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-05"))).toBe(true);
    });

    it("期日確定型: 期日でスキップしたものは含めない", () => {
      const input = makeInput({
        config: weekdays(2, 5),
        createdAt: created,
        logs: skip("2026-08-04"),
      });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-04"))).toBe(false);
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-07"))).toBe(true);
    });

    it("一時停止中は含めない", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        pauses: [pause("2026-08-01", null)],
      });
      expect(isNotificationTarget(evaluateDutyOn(input, "2026-08-05"))).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------

describe("getWeeklyAchievement", () => {
  const created = on("2026-07-01");

  describe("期日確定型", () => {
    it("分母は週内に到来した期日数、分子はそのうち DONE の数（SKIP は未達）", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        logs: [...done("2026-08-03", "2026-08-04", "2026-08-05"), ...skip("2026-08-06")],
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 3,
        total: 7,
      });
    });

    it("週内のどの日を渡しても同じ週", () => {
      const input = makeInput({ config: DAILY, createdAt: created, logs: done("2026-08-03") });
      expect(getWeeklyAchievement(input, "2026-08-03", "2026-08-20")).toEqual({
        done: 1,
        total: 7,
      });
      expect(getWeeklyAchievement(input, "2026-08-09", "2026-08-20")).toEqual({
        done: 1,
        total: 7,
      });
    });

    it("asOf が週の途中なら asOf までの期日だけ数える", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        logs: done("2026-08-03", "2026-08-05", "2026-08-07"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-05")).toEqual({
        done: 2,
        total: 3,
      });
    });

    it("期日でない日の DONE は数えない", () => {
      const input = makeInput({
        config: weekdays(2, 5),
        createdAt: created,
        logs: done("2026-08-04", "2026-08-05"),
      });
      expect(getWeeklyAchievement(input, "2026-08-04", "2026-08-09")).toEqual({
        done: 1,
        total: 2,
      });
    });

    it("SKIP は分母に入り分子に入らない", () => {
      const input = makeInput({
        config: weekdays(2, 5),
        createdAt: created,
        logs: [...skip("2026-08-04"), ...done("2026-08-07")],
      });
      expect(getWeeklyAchievement(input, "2026-08-04", "2026-08-09")).toEqual({
        done: 1,
        total: 2,
      });
    });

    it("作成週は作成日から数える", () => {
      const input = makeInput({ config: DAILY, createdAt: on("2026-08-06") });
      expect(getWeeklyAchievement(input, "2026-08-06", "2026-08-09")).toEqual({
        done: 0,
        total: 4,
      });
    });

    it("作成日より前の週・asOf より後の週は 0/0", () => {
      const input = makeInput({ config: DAILY, createdAt: on("2026-08-06") });
      expect(getWeeklyAchievement(input, "2026-07-29", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
      expect(getWeeklyAchievement(input, "2026-08-12", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
    });

    it("一時停止期間は分母・分子から除く", () => {
      // 8/5〜8/7 停止 → 有効日は 3・4・8・9
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        pauses: [pause("2026-08-05", "2026-08-08")],
        logs: done("2026-08-04", "2026-08-06", "2026-08-08"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 2,
        total: 4,
      });
    });

    it("アーカイブした日以降は分母・分子から除く", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        archivedAt: on("2026-08-07"),
        logs: done("2026-08-06", "2026-08-07"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 1,
        total: 4,
      });
    });

    it("隔週の休みの週は 0/0、当たりの週は 1", () => {
      const input = makeInput({
        config: biweekly("2026-08-05", 3),
        createdAt: created,
        logs: done("2026-08-05"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-31")).toEqual({
        done: 1,
        total: 1,
      });
      expect(getWeeklyAchievement(input, "2026-08-12", "2026-08-31")).toEqual({
        done: 0,
        total: 0,
      });
      expect(getWeeklyAchievement(input, "2026-08-19", "2026-08-31")).toEqual({
        done: 0,
        total: 1,
      });
    });

    it("月末に丸めた期日も分母に入る", () => {
      // 2026-02-23〜03-01 の週に、31日指定の丸め先 2/28 が入る
      const input = makeInput({
        config: monthlyDay(31),
        createdAt: on("2026-01-01"),
        logs: done("2026-02-28"),
      });
      expect(getWeeklyAchievement(input, "2026-02-25", "2026-03-10")).toEqual({
        done: 1,
        total: 1,
      });
    });

    it("週の始まりで集計する週が変わる", () => {
      // 日曜だけの Duty、8/9（日）に DONE。8/8（土）を含む週を見る
      const config = weekdays(0);
      const logs = done("2026-08-09");
      const mon = makeInput({ config, createdAt: created, logs, weekStart: 1 }); // 8/3〜8/9
      const sun = makeInput({ config, createdAt: created, logs, weekStart: 0 }); // 8/2〜8/8
      expect(getWeeklyAchievement(mon, "2026-08-08", "2026-08-20")).toEqual({ done: 1, total: 1 });
      expect(getWeeklyAchievement(sun, "2026-08-08", "2026-08-20")).toEqual({ done: 0, total: 1 });
    });

    it("作成日はタイムゾーンで決まる", () => {
      const tokyo = makeInput({
        config: DAILY,
        createdAt: TOKYO_MIDNIGHT_0805,
        timeZone: "Asia/Tokyo",
      });
      const utc = makeInput({ config: DAILY, createdAt: TOKYO_MIDNIGHT_0805, timeZone: "UTC" });
      expect(getWeeklyAchievement(tokyo, "2026-08-05", "2026-08-09")).toEqual({
        done: 0,
        total: 5,
      });
      expect(getWeeklyAchievement(utc, "2026-08-05", "2026-08-09")).toEqual({ done: 0, total: 6 });
    });
  });

  describe("WEEKLY_COUNT", () => {
    it("分母は timesPerWeek、分子は週内の DONE の数", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: [...done("2026-08-03", "2026-08-04"), ...skip("2026-08-05")],
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 2,
        total: 3,
      });
    });

    it("分子は分母で頭打ち", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 3,
        total: 3,
      });
    });

    it("asOf が週の途中でも分母は週全体の目標", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-06"),
      });
      expect(getWeeklyAchievement(input, "2026-08-04", "2026-08-04")).toEqual({
        done: 1,
        total: 3,
      });
    });

    it("前後の週の DONE は数えない", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-02", "2026-08-04", "2026-08-10"),
      });
      expect(getWeeklyAchievement(input, "2026-08-04", "2026-08-20")).toEqual({
        done: 1,
        total: 3,
      });
    });

    it("作成週は min(timesPerWeek, 作成日から週末までの日数)、翌週は timesPerWeek", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: on("2026-08-08"),
        logs: done("2026-08-08"),
      });
      expect(getWeeklyAchievement(input, "2026-08-08", "2026-08-09")).toEqual({
        done: 1,
        total: 2,
      });
      expect(getWeeklyAchievement(input, "2026-08-10", "2026-08-16")).toEqual({
        done: 0,
        total: 3,
      });
    });

    it("一時停止で欠けた週は有効日数で頭打ち、停止中の DONE は数えない", () => {
      // 8/4〜8/8 停止 → 有効日は 3・9 の2日
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        pauses: [pause("2026-08-04", "2026-08-09")],
        logs: done("2026-08-03", "2026-08-05"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 1,
        total: 2,
      });
    });

    it("週がまるごと一時停止なら 0/0", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        pauses: [pause("2026-08-01", "2026-08-12")],
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-20")).toEqual({
        done: 0,
        total: 0,
      });
    });

    it("作成日より前の週・asOf より後の週は 0/0", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-06") });
      expect(getWeeklyAchievement(input, "2026-07-29", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
      expect(getWeeklyAchievement(input, "2026-08-12", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
    });

    it("週の始まりで集計する週が変わる", () => {
      // 8/8（土）・8/9（日）に DONE。8/9 を含む週を見る
      const logs = done("2026-08-08", "2026-08-09");
      const mon = makeInput({ config: weeklyCount(2), createdAt: created, logs, weekStart: 1 }); // 8/3〜8/9
      const sun = makeInput({ config: weeklyCount(2), createdAt: created, logs, weekStart: 0 }); // 8/9〜8/15
      expect(getWeeklyAchievement(mon, "2026-08-09", "2026-08-20")).toEqual({ done: 2, total: 2 });
      expect(getWeeklyAchievement(sun, "2026-08-09", "2026-08-20")).toEqual({ done: 1, total: 2 });
    });
  });

  describe("SINCE_LAST", () => {
    it("週末時点で催促が続いていれば、DONE の数 +1 が分母", () => {
      // 8/7 の DONE から 8/9 で2日 → 週末時点で催促中
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-01", "2026-08-04", "2026-08-07"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 2,
        total: 3,
      });
    });

    it("週末時点で催促がなければ、DONE の数が分母", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04", "2026-08-08"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 2,
        total: 2,
      });
    });

    it("週末当日に済ませていれば +1 しない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04", "2026-08-07", "2026-08-09"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 3,
        total: 3,
      });
    });

    it("毎日済ませれば DONE の数がそのまま分母", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done(
          "2026-08-03",
          "2026-08-04",
          "2026-08-05",
          "2026-08-06",
          "2026-08-07",
          "2026-08-08",
          "2026-08-09",
        ),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 7,
        total: 7,
      });
    });

    it("SKIP は分子に入らない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: [...done("2026-08-04"), ...skip("2026-08-08")],
      });
      // 8/9 時点で 8/4 から5日 → 催促中
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 1,
        total: 2,
      });
    });

    it("今週は asOf 時点で判定し、asOf より後の DONE は数えない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-07"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-05")).toEqual({
        done: 1,
        total: 2,
      });
    });

    it("作成週で DONE がなければ 0/1", () => {
      const input = makeInput({ config: sinceLast(2), createdAt: on("2026-08-06") });
      expect(getWeeklyAchievement(input, "2026-08-06", "2026-08-09")).toEqual({
        done: 0,
        total: 1,
      });
    });

    it("作成日より前の週・asOf より後の週は 0/0", () => {
      const input = makeInput({ config: sinceLast(2), createdAt: on("2026-08-06") });
      expect(getWeeklyAchievement(input, "2026-07-29", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
      expect(getWeeklyAchievement(input, "2026-08-12", "2026-08-09")).toEqual({
        done: 0,
        total: 0,
      });
    });

    it("週末が一時停止中なら +1 しない。停止中の DONE は分子に入らない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        pauses: [pause("2026-08-08", null)],
        logs: done("2026-08-04", "2026-08-08"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 1,
        total: 1,
      });
    });

    it("週末がアーカイブ後なら +1 しない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        archivedAt: on("2026-08-08"),
        logs: done("2026-08-04"),
      });
      expect(getWeeklyAchievement(input, "2026-08-05", "2026-08-09")).toEqual({
        done: 1,
        total: 1,
      });
    });

    it("週の始まりで集計する週と週末が変わる", () => {
      // 8/1（土）・8/9（日）に DONE。8/8（土）を含む週を見る
      const logs = done("2026-08-01", "2026-08-09");
      const mon = makeInput({ config: sinceLast(2), createdAt: created, logs, weekStart: 1 }); // 8/3〜8/9、週末 8/9 に DONE
      const sun = makeInput({ config: sinceLast(2), createdAt: created, logs, weekStart: 0 }); // 8/2〜8/8、週末 8/8 は 8/1 から7日
      expect(getWeeklyAchievement(mon, "2026-08-08", "2026-08-20")).toEqual({ done: 1, total: 1 });
      expect(getWeeklyAchievement(sun, "2026-08-08", "2026-08-20")).toEqual({ done: 0, total: 1 });
    });
  });
});

// ---------------------------------------------------------------------------

describe("getNextDue", () => {
  const created = on("2026-07-01");

  describe("期日確定型", () => {
    it("from 当日が期日なら当日", () => {
      expect(getNextDue(makeInput({ config: DAILY, createdAt: created }), "2026-08-05")).toEqual({
        type: "DATE",
        date: "2026-08-05",
      });
      expect(
        getNextDue(makeInput({ config: weekdays(2, 5), createdAt: created }), "2026-08-04"),
      ).toEqual({
        type: "DATE",
        date: "2026-08-04",
      });
    });

    it("当日に済ませていても、当日が期日なら当日（期日確定型はログを見ない。SPEC.md）", () => {
      const input = makeInput({
        config: weekdays(2, 5),
        createdAt: created,
        logs: done("2026-08-04"),
      });
      expect(getNextDue(input, "2026-08-04")).toEqual({ type: "DATE", date: "2026-08-04" });
    });

    it("WEEKDAYS: 次の該当曜日（週をまたぐ）", () => {
      const input = makeInput({ config: weekdays(2, 5), createdAt: created });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-07" });
      expect(getNextDue(input, "2026-08-08")).toEqual({ type: "DATE", date: "2026-08-11" });
    });

    it("MONTHLY: 月末に丸めた日", () => {
      const at = (from: string) =>
        getNextDue(makeInput({ config: monthlyDay(31), createdAt: on("2026-01-01") }), from);
      expect(at("2026-02-01")).toEqual({ type: "DATE", date: "2026-02-28" });
      expect(at("2026-03-01")).toEqual({ type: "DATE", date: "2026-03-31" });
      expect(at("2026-04-01")).toEqual({ type: "DATE", date: "2026-04-30" });
      expect(at("2026-08-31")).toEqual({ type: "DATE", date: "2026-08-31" });
      expect(at("2026-09-01")).toEqual({ type: "DATE", date: "2026-09-30" });

      const leap = getNextDue(
        makeInput({ config: monthlyDay(31), createdAt: on("2028-01-01") }),
        "2028-02-01",
      );
      expect(leap).toEqual({ type: "DATE", date: "2028-02-29" });
    });

    it("MONTHLY: 第N曜日・最終曜日", () => {
      const input = (config: FixedDueScheduleConfig) => makeInput({ config, createdAt: created });
      expect(getNextDue(input(monthlyNth(1, 1)), "2026-08-04")).toEqual({
        type: "DATE",
        date: "2026-09-07",
      });
      expect(getNextDue(input(monthlyNth(-1, 1)), "2026-08-01")).toEqual({
        type: "DATE",
        date: "2026-08-31",
      });
      expect(getNextDue(input(monthlyNth(4, 1)), "2026-08-25")).toEqual({
        type: "DATE",
        date: "2026-09-28",
      });
    });

    it("NTH_WEEK: 隔週の次の当たり日", () => {
      const input = makeInput({ config: biweekly("2026-08-05", 3), createdAt: created });
      expect(getNextDue(input, "2026-07-01")).toEqual({ type: "DATE", date: "2026-08-05" });
      expect(getNextDue(input, "2026-08-06")).toEqual({ type: "DATE", date: "2026-08-19" });
      expect(getNextDue(input, "2026-08-12")).toEqual({ type: "DATE", date: "2026-08-19" });
      expect(getNextDue(input, "2026-08-19")).toEqual({ type: "DATE", date: "2026-08-19" });
    });

    it("作成日が from より後なら作成日以降の期日", () => {
      const input = makeInput({ config: DAILY, createdAt: on("2026-08-05") });
      expect(getNextDue(input, "2026-08-03")).toEqual({ type: "DATE", date: "2026-08-05" });
    });

    it("一時停止中（endDate: null）は null。停止前なら停止前の期日", () => {
      const input = makeInput({
        config: DAILY,
        createdAt: created,
        pauses: [pause("2026-08-05", null)],
      });
      expect(getNextDue(input, "2026-08-06")).toBeNull();
      expect(getNextDue(input, "2026-08-03")).toEqual({ type: "DATE", date: "2026-08-03" });
    });

    it("再開日が決まっている一時停止は、再開後の期日", () => {
      const daily = makeInput({
        config: DAILY,
        createdAt: created,
        pauses: [pause("2026-08-05", "2026-08-10")],
      });
      expect(getNextDue(daily, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-10" });

      // 火曜のみ、8/4〜8/11 停止（8/12 再開）→ 8/4・8/11 は停止中、次は 8/18
      const tue = makeInput({
        config: weekdays(2),
        createdAt: created,
        pauses: [pause("2026-08-04", "2026-08-12")],
      });
      expect(getNextDue(tue, "2026-08-04")).toEqual({ type: "DATE", date: "2026-08-18" });
    });

    it("アーカイブ済みなら null", () => {
      const daily = makeInput({ config: DAILY, createdAt: created, archivedAt: on("2026-08-10") });
      expect(getNextDue(daily, "2026-08-09")).toEqual({ type: "DATE", date: "2026-08-09" });
      expect(getNextDue(daily, "2026-08-10")).toBeNull();

      // 次の期日 8/11（火）がアーカイブ後
      const tueFri = makeInput({
        config: weekdays(2, 5),
        createdAt: created,
        archivedAt: on("2026-08-10"),
      });
      expect(getNextDue(tueFri, "2026-08-08")).toBeNull();
    });
  });

  describe("SINCE_LAST", () => {
    it("初回（DONE なし）は作成日。作成日が from より前なら from", () => {
      expect(
        getNextDue(makeInput({ config: sinceLast(2), createdAt: created }), "2026-08-05"),
      ).toEqual({
        type: "DATE",
        date: "2026-08-05",
      });
      // 作成前のプレビュー（createdAt = 現在時刻）
      expect(
        getNextDue(makeInput({ config: sinceLast(2), createdAt: on("2026-08-05") }), "2026-08-05"),
      ).toEqual({
        type: "DATE",
        date: "2026-08-05",
      });
      expect(
        getNextDue(makeInput({ config: sinceLast(2), createdAt: on("2026-08-07") }), "2026-08-05"),
      ).toEqual({
        type: "DATE",
        date: "2026-08-07",
      });
    });

    it("前回 DONE + days 日", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-06" });
    });

    it("from 当日の DONE も起点にする", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-05"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-07" });
    });

    it("すでに催促中なら from", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-01"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-05" });
    });

    it("SKIP は起点にならない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: [...done("2026-08-03"), ...skip("2026-08-04")],
      });
      expect(getNextDue(input, "2026-08-04")).toEqual({ type: "DATE", date: "2026-08-05" });
    });

    it("from より後の DONE は見ない", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04", "2026-08-07"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-06" });
    });

    it("催促が始まる日が一時停止中なら再開日", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04"),
        pauses: [pause("2026-08-05", "2026-08-10")],
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({ type: "DATE", date: "2026-08-10" });
    });

    it("一時停止中（endDate: null）は null", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04"),
        pauses: [pause("2026-08-05", null)],
      });
      expect(getNextDue(input, "2026-08-05")).toBeNull();
    });

    it("催促が始まる日がアーカイブ後なら null", () => {
      const input = makeInput({
        config: sinceLast(2),
        createdAt: created,
        logs: done("2026-08-04"),
        archivedAt: on("2026-08-06"),
      });
      expect(getNextDue(input, "2026-08-05")).toBeNull();
    });
  });

  describe("WEEKLY_COUNT", () => {
    it("週の残回数と週の最終日", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 2,
        weekEnd: "2026-08-09",
      });
    });

    it("from 当日の DONE も差し引く", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-05"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 1,
        weekEnd: "2026-08-09",
      });
    });

    it("済ませきったら残回数 0、from より後の DONE は差し引かない", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"),
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 0,
        weekEnd: "2026-08-09",
      });
      expect(getNextDue(input, "2026-08-04")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 1,
        weekEnd: "2026-08-09",
      });
    });

    it("前の週の DONE は差し引かない", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-02"),
      });
      expect(getNextDue(input, "2026-08-03")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 3,
        weekEnd: "2026-08-09",
      });
    });

    it("週の始まりが日曜なら週の最終日は土曜", () => {
      const input = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        logs: done("2026-08-03"),
        weekStart: 0,
      });
      expect(getNextDue(input, "2026-08-05")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 2,
        weekEnd: "2026-08-08",
      });
    });

    it("作成前のプレビュー（土曜作成）は作成週の目標", () => {
      const input = makeInput({ config: weeklyCount(3), createdAt: on("2026-08-08") });
      expect(getNextDue(input, "2026-08-08")).toEqual({
        type: "WEEKLY_COUNT",
        remaining: 2,
        weekEnd: "2026-08-09",
      });
    });

    it("一時停止中・アーカイブ済みは null", () => {
      const paused = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        pauses: [pause("2026-08-05", "2026-08-10")],
      });
      expect(getNextDue(paused, "2026-08-06")).toBeNull();
      const archived = makeInput({
        config: weeklyCount(3),
        createdAt: created,
        archivedAt: on("2026-08-05"),
      });
      expect(getNextDue(archived, "2026-08-05")).toBeNull();
    });
  });
});
