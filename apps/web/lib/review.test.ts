import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { duties, dutyPauses, logs } from "@zumi/db/schema";
import { addDays, type LogStatus, type ScheduleConfig } from "@zumi/types";
// 週次通知と同じ数字になることを確かめるため、notify の読み込みと集計をそのまま使う
import { summarizeWeek, type NotifyDuty } from "../../notify/src/digest";
import {
  buildWeeklySummary,
  getHistoryStartDate,
  getIsoWeekNumber,
  HISTORY_PAGE_DAYS,
  listHistoryDuties,
  loadHistory,
  loadSummaryDuties,
  loadWeeklySummary,
  type SummaryDuty,
} from "./review";
import { createTestDb } from "./test-d1";

const TZ = "Asia/Tokyo";
const CALENDAR = { timeZone: TZ, weekStart: 1 as const };

// 2026年10月〜11月（月曜始まり）
//  月 火 水 木 金 土 日
//  19 20 21 22 23 24 25
//  26 27 28 29 30 31  1
//   2  3  4  5  6  7  8
const TODAY = "2026-11-05";
/** 東京で 2026-11-05（木）の 20:00 */
const NOW = new Date("2026-11-05T11:00:00Z");

/**
 * notify の `createD1Store`。store.ts は web と版の違う workers-types で書かれており、
 * 静的に import すると web の型検査に入って衝突するため、使う部分だけ型を書いて実行時に読み込む
 */
const NOTIFY_STORE = "../../notify/src/store";
async function loadNotifyDuties(d1: D1Database, userId: string, rangeStart: string, today: string) {
  const { createD1Store } = (await import(/* @vite-ignore */ NOTIFY_STORE)) as {
    createD1Store: (d1: D1Database) => {
      loadDuties(
        settings: { userId: string; timezone: string; weekStart: 0 | 1 },
        rangeStart: string,
        today: string,
        now: Date,
      ): Promise<NotifyDuty[]>;
    };
  };
  return createD1Store(d1).loadDuties(
    { userId, timezone: TZ, weekStart: 1 },
    rangeStart,
    today,
    NOW,
  );
}

const jst = (date: string, time = "10:00") => new Date(`${date}T${time}:00+09:00`);

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let userCount = 0;
let dutyCount = 0;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  userCount++;
  userId = await testDb.createUser(`review-${userCount}`);
});

async function addDuty(
  name: string,
  scheduleConfig: ScheduleConfig,
  options: {
    createdAt?: Date;
    archivedAt?: Date;
    pauses?: { startDate: string; endDate: string | null }[];
    logs?: Record<string, LogStatus>;
    note?: Record<string, string>;
  } = {},
) {
  const id = `duty-${++dutyCount}`;
  await testDb.db.insert(duties).values({
    id,
    userId,
    name,
    icon: "circle",
    scheduleType: scheduleConfig.type,
    scheduleConfig,
    sortOrder: dutyCount,
    status: options.archivedAt ? "ARCHIVED" : "ACTIVE",
    createdAt: options.createdAt ?? jst("2026-10-01"),
    archivedAt: options.archivedAt ?? null,
  });
  for (const pause of options.pauses ?? []) {
    await testDb.db.insert(dutyPauses).values({ id: crypto.randomUUID(), dutyId: id, ...pause });
  }
  for (const [targetDate, status] of Object.entries(options.logs ?? {})) {
    await testDb.db.insert(logs).values({
      id: crypto.randomUUID(),
      userId,
      dutyId: id,
      targetDate,
      status,
      loggedAt: jst(targetDate, "21:10"),
      note: options.note?.[targetDate] ?? null,
    });
  }
  return id;
}

describe("getHistoryStartDate（無料プランの3ヶ月の境界）", () => {
  it.each([
    ["2026-11-02", "2026-08-02"],
    ["2026-01-15", "2025-10-15"],
    ["2026-03-31", "2025-12-31"],
    // 同じ日がない月は月末に丸める
    ["2026-05-31", "2026-02-28"],
    ["2028-05-31", "2028-02-29"],
    ["2026-12-31", "2026-09-30"],
  ])("%s の3ヶ月前は %s（その日を含む）", (today, start) => {
    expect(getHistoryStartDate(today)).toBe(start);
  });
});

describe("getIsoWeekNumber", () => {
  it.each([
    ["2026-08-17", 34],
    ["2026-01-01", 1],
    ["2026-12-31", 53],
    ["2027-01-01", 53],
    ["2027-01-04", 1],
  ])("%s は第%i週", (date, week) => {
    expect(getIsoWeekNumber(date)).toBe(week);
  });
});

describe("週次サマリー", () => {
  /** 6タイプ・一時停止・アーカイブ・作成週を1人のユーザーに入れる */
  async function seedWeek() {
    const ids = {
      daily: await addDuty(
        "毎日",
        { type: "DAILY" },
        {
          logs: {
            "2026-10-26": "DONE",
            "2026-10-27": "DONE",
            "2026-10-28": "DONE",
            "2026-11-02": "DONE",
            "2026-11-03": "DONE",
            "2026-11-04": "SKIP",
          },
        },
      ),
      // 火・金。期日でない水曜（対象日の変更）の DONE は分子に数えない
      weekdays: await addDuty(
        "火金",
        { type: "WEEKDAYS", weekdays: [2, 5] },
        {
          logs: { "2026-10-27": "DONE", "2026-11-03": "DONE", "2026-11-04": "DONE" },
        },
      ),
      // 隔週月曜（10/5 起点 → 10/19・11/2 の週）
      nthWeek: await addDuty(
        "隔週月",
        { type: "NTH_WEEK", weekdays: [1], every: 2, anchor: "2026-10-05" },
        { logs: { "2026-11-02": "DONE" } },
      ),
      // 毎月1日（11/1 は前の週の日曜）
      monthly: await addDuty(
        "毎月1日",
        { type: "MONTHLY", dayOfMonth: 1 },
        {
          logs: { "2026-11-01": "DONE" },
        },
      ),
      // 前の週は3回済ませても目標の2回で頭打ち
      weeklyCount: await addDuty(
        "週2",
        { type: "WEEKLY_COUNT", timesPerWeek: 2 },
        {
          logs: {
            "2026-10-26": "DONE",
            "2026-10-27": "DONE",
            "2026-10-28": "DONE",
            "2026-11-02": "DONE",
          },
        },
      ),
      // 前回 DONE（10/20）は読み込む期間より前。一時停止中に付いた DONE も起点に使う
      sinceLast: await addDuty(
        "2日空いたら",
        { type: "SINCE_LAST", days: 2 },
        {
          logs: { "2026-10-20": "DONE", "2026-10-29": "DONE", "2026-11-03": "DONE" },
        },
      ),
      // 10/28〜11/3 は一時停止（11/4 に再開）。一時停止中の DONE（11/2）は数えない
      paused: await addDuty(
        "一時停止",
        { type: "DAILY" },
        {
          pauses: [{ startDate: "2026-10-28", endDate: "2026-11-04" }],
          logs: { "2026-10-26": "DONE", "2026-11-02": "DONE", "2026-11-04": "DONE" },
        },
      ),
      // 11/3 にアーカイブ（11/3 から対象外）
      archived: await addDuty(
        "アーカイブ",
        { type: "DAILY" },
        {
          archivedAt: jst("2026-11-03"),
          logs: { "2026-11-02": "DONE" },
        },
      ),
      // 今週の水曜（11/4）に作成
      createdThisWeek: await addDuty(
        "作成週",
        { type: "WEEKLY_COUNT", timesPerWeek: 3 },
        {
          createdAt: jst("2026-11-04"),
          logs: { "2026-11-05": "DONE" },
        },
      ),
      // ずっと前にアーカイブした Duty は数えない
      archivedLongAgo: await addDuty(
        "昔のアーカイブ",
        { type: "DAILY" },
        {
          archivedAt: jst("2026-10-10"),
          logs: { "2026-10-05": "DONE" },
        },
      ),
    };
    return ids;
  }

  it("Duty ごとの分子・分母を合計し、前週との差分は済んだ数の差", async () => {
    const ids = await seedWeek();
    const summary = await loadWeeklySummary(testDb.db, userId, TODAY, TODAY, CALENDAR);

    const breakdown = Object.fromEntries(
      summary.duties.map((duty) => [duty.id, { done: duty.done, total: duty.total }]),
    );
    expect(breakdown).toEqual({
      [ids.daily]: { done: 2, total: 4 },
      [ids.weekdays]: { done: 1, total: 1 },
      [ids.nthWeek]: { done: 1, total: 1 },
      // 毎月1日は今週の期日がないので内訳に出さない
      [ids.weeklyCount]: { done: 1, total: 2 },
      // 11/3 に済 → 今日（11/5）で2日経ち、まだ済ませていないので +1
      [ids.sinceLast]: { done: 1, total: 2 },
      [ids.paused]: { done: 1, total: 2 },
      [ids.archived]: { done: 1, total: 1 },
      // 作成日〜週末が5日あるので目標は3回のまま
      [ids.createdThisWeek]: { done: 1, total: 3 },
    });
    expect(summary).toMatchObject({
      weekStart: "2026-11-02",
      weekEnd: "2026-11-08",
      weekNumber: 45,
      isCurrentWeek: true,
      done: 9,
      total: 16,
    });
    // 前の週の同じ曜日（10/29 木）まで: 毎日3 + 火金1 + 週2 2 + 2日空いたら1 + 一時停止1 = 8
    // （毎月1日の 11/1 は日曜なのでまだ数えない）
    expect(summary.previousDone).toBe(8);
    expect(summary.diff).toBe(1);
  });

  it("週次通知（apps/notify の summarizeWeek）と同じ数字になる", async () => {
    await seedWeek();
    for (const today of ["2026-11-05", "2026-11-08"]) {
      const notifyDuties = await loadNotifyDuties(testDb.d1, userId, "2026-10-26", today);
      const expected = summarizeWeek(notifyDuties, today);
      const summary = await loadWeeklySummary(testDb.db, userId, today, today, CALENDAR);
      expect({ done: summary.done, total: summary.total }).toEqual(expected.thisWeek);
    }
    // 前週比は、週次通知を送る週の最終日にはどちらの定義でも同じになる
    const lastDay = "2026-11-08";
    const notifyDuties = await loadNotifyDuties(testDb.d1, userId, "2026-10-26", lastDay);
    const expected = summarizeWeek(notifyDuties, lastDay);
    const summary = await loadWeeklySummary(testDb.db, userId, lastDay, lastDay, CALENDAR);
    expect(summary.previousDone).toBe(expected.lastWeek.done);
    expect(summary.diff).toBe(expected.thisWeek.done - expected.lastWeek.done);
  });

  describe("前週比は、今週なら前の週の同じ曜日まで、終わった週なら前の週まるごとで比べる", () => {
    // 前の2週は毎日済ませ、今週（月曜始まりは 11/2〜、日曜始まりは 11/1〜）は何もしていない
    const doneLogs: { targetDate: string; status: LogStatus }[] = [];
    for (let date = "2026-10-18"; date <= "2026-11-01"; date = addDays(date, 1)) {
      doneLogs.push({ targetDate: date, status: "DONE" });
    }
    const dailyDuty = (weekStart: 0 | 1): SummaryDuty => {
      const duty = {
        id: "daily",
        name: "毎日",
        icon: "circle",
        scheduleConfig: { type: "DAILY" } as const,
        createdAt: jst("2026-10-01"),
        archivedAt: null,
      };
      return { duty, schedule: { duty, logs: doneLogs, pauses: [], timeZone: TZ, weekStart } };
    };

    it.each([
      // [週の始まり, 今日, 開く週, 前の週の済んだ数]
      [1, "2026-11-02", "2026-11-02", 1], // 週の初日（月）: 前の週の月曜だけ
      [1, "2026-11-05", "2026-11-02", 4], // 週の途中（木）: 前の週の月〜木
      [1, "2026-11-08", "2026-11-02", 7], // 週の最終日（日）: 前の週まるごと
      [1, "2026-11-05", "2026-10-26", 7], // 終わった週: 前の週まるごと
      [0, "2026-11-01", "2026-11-01", 1], // 週の初日（日）
      [0, "2026-11-04", "2026-11-01", 4], // 週の途中（水）
      [0, "2026-11-07", "2026-11-01", 7], // 週の最終日（土）
      [0, "2026-11-05", "2026-10-25", 7], // 終わった週
    ] as const)(
      "週の始まり %i・今日 %s・%s の週 → 前の週 %i",
      (weekStart, today, week, expected) => {
        const summary = buildWeeklySummary([dailyDuty(weekStart)], week, today, weekStart);
        expect(summary.previousDone).toBe(expected);
        expect(summary.diff).toBe(summary.done - expected);
      },
    );
  });

  it("日曜始まりでは週の区切りが変わる", async () => {
    await addDuty(
      "毎日",
      { type: "DAILY" },
      {
        logs: { "2026-11-01": "DONE", "2026-11-02": "DONE", "2026-10-31": "DONE" },
      },
    );
    const summary = await loadWeeklySummary(testDb.db, userId, TODAY, TODAY, {
      timeZone: TZ,
      weekStart: 0,
    });
    // 11/1（日）〜11/7（土）の今日まで: 11/1〜11/5 の5日中2日。
    // 前の週（10/25〜10/31）の同じ曜日（10/29 木）までには、10/31 の済はまだ入らない
    expect(summary).toMatchObject({
      weekStart: "2026-11-01",
      weekEnd: "2026-11-07",
      done: 2,
      total: 5,
      previousDone: 0,
      diff: 2,
    });
  });

  it("過去の週は週末まで数え、前の週と比べる", async () => {
    await seedWeek();
    const summary = await loadWeeklySummary(testDb.db, userId, "2026-10-28", TODAY, CALENDAR);
    expect(summary).toMatchObject({
      weekStart: "2026-10-26",
      weekEnd: "2026-11-01",
      isCurrentWeek: false,
      done: 9,
    });
    // その前の週（10/19〜10/25）は 2日空いたら の 10/20 だけ
    expect(summary.previousDone).toBe(1);
    expect(summary.diff).toBe(8);
  });

  it("前の週より前にアーカイブした Duty は読まない", async () => {
    await addDuty("昔のアーカイブ", { type: "DAILY" }, { archivedAt: jst("2026-10-10") });
    const kept = await addDuty(
      "前の週にアーカイブ",
      { type: "DAILY" },
      {
        archivedAt: jst("2026-10-28"),
      },
    );
    const loaded = await loadSummaryDuties(testDb.db, userId, TODAY, CALENDAR);
    expect(loaded.map(({ duty }) => duty.id)).toEqual([kept]);
  });

  it("Duty がなければ 0 / 0", () => {
    const summary = buildWeeklySummary([], TODAY, TODAY, 1);
    expect(summary).toMatchObject({ done: 0, total: 0, diff: 0, duties: [] });
    expect(summary.caption).toBe("今週の予定はありません");
  });
});

describe("履歴", () => {
  it("日付ごとに新しい順。期日でない日の記録・アーカイブ済みの Duty の記録・メモも出す", async () => {
    const weekdays = await addDuty(
      "火金",
      { type: "WEEKDAYS", weekdays: [2, 5] },
      {
        logs: { "2026-11-03": "DONE", "2026-11-04": "DONE" },
        note: { "2026-11-04": "水曜に出した" },
      },
    );
    const archived = await addDuty(
      "アーカイブ",
      { type: "DAILY" },
      {
        archivedAt: jst("2026-11-04"),
        logs: { "2026-11-03": "SKIP" },
      },
    );
    const page = await loadHistory(testDb.db, userId, { today: TODAY }, TZ);
    expect(page).toEqual({
      days: [
        {
          date: "2026-11-04",
          entries: [
            {
              dutyId: weekdays,
              name: "火金",
              icon: "circle",
              status: "DONE",
              note: "水曜に出した",
              loggedTime: "21:10",
            },
          ],
        },
        {
          date: "2026-11-03",
          entries: [
            expect.objectContaining({ dutyId: weekdays, status: "DONE" }),
            expect.objectContaining({ dutyId: archived, name: "アーカイブ", status: "SKIP" }),
          ],
        },
      ],
      nextBefore: null,
      reachedLimit: false,
    });
  });

  it("対象日と別の日に記録したときは、記録した日付も付ける", async () => {
    const id = await addDuty("毎日", { type: "DAILY" });
    await testDb.db.insert(logs).values({
      id: crypto.randomUUID(),
      userId,
      dutyId: id,
      targetDate: "2026-11-03",
      status: "DONE",
      loggedAt: jst("2026-11-04", "07:42"),
    });
    const page = await loadHistory(testDb.db, userId, { today: TODAY }, TZ);
    expect(page.days[0]!.entries[0]!.loggedTime).toBe("11/4 7:42");
  });

  it(`${HISTORY_PAGE_DAYS}日ずつ読み、続きは before でさかのぼる`, async () => {
    const dates = Array.from({ length: 20 }, (_, i) => addDays(TODAY, -i));
    await addDuty(
      "毎日",
      { type: "DAILY" },
      {
        logs: Object.fromEntries(dates.map((date) => [date, "DONE" as const])),
      },
    );
    await addDuty(
      "毎日2",
      { type: "DAILY" },
      {
        logs: Object.fromEntries(dates.map((date) => [date, "SKIP" as const])),
      },
    );

    const first = await loadHistory(testDb.db, userId, { today: TODAY }, TZ);
    expect(first.days.map((day) => day.date)).toEqual(dates.slice(0, HISTORY_PAGE_DAYS));
    expect(first.days.every((day) => day.entries.length === 2)).toBe(true);
    expect(first.nextBefore).toBe(dates[HISTORY_PAGE_DAYS - 1]);

    const second = await loadHistory(
      testDb.db,
      userId,
      { today: TODAY, before: first.nextBefore! },
      TZ,
    );
    expect(second.days.map((day) => day.date)).toEqual(dates.slice(HISTORY_PAGE_DAYS));
    expect(second).toMatchObject({ nextBefore: null, reachedLimit: false });
  });

  it("Duty で絞り込む", async () => {
    const a = await addDuty(
      "A",
      { type: "DAILY" },
      {
        logs: { "2026-11-05": "DONE", "2026-11-03": "DONE" },
      },
    );
    await addDuty("B", { type: "DAILY" }, { logs: { "2026-11-04": "DONE" } });
    const page = await loadHistory(testDb.db, userId, { today: TODAY, dutyId: a }, TZ);
    expect(page.days.map((day) => [day.date, day.entries.map((entry) => entry.dutyId)])).toEqual([
      ["2026-11-05", [a]],
      ["2026-11-03", [a]],
    ]);
  });

  it("他のユーザーの記録は出さない", async () => {
    const mine = userId;
    await addDuty("他人", { type: "DAILY" }, { logs: { "2026-11-05": "DONE" } });
    userId = await testDb.createUser(`review-other-${userCount}`);
    const page = await loadHistory(testDb.db, userId, { today: TODAY }, TZ);
    expect(page.days).toEqual([]);
    userId = mine;
  });

  it("3ヶ月より前は出さず、その先に記録があれば制限に達したことを返す", async () => {
    // 今日 11/5 → 8/5 まで
    const a = await addDuty(
      "A",
      { type: "DAILY" },
      {
        createdAt: jst("2026-07-01"),
        logs: { "2026-08-05": "DONE", "2026-08-04": "DONE" },
      },
    );
    const b = await addDuty(
      "B",
      { type: "DAILY" },
      {
        createdAt: jst("2026-07-01"),
        logs: { "2026-08-10": "DONE" },
      },
    );
    const page = await loadHistory(testDb.db, userId, { today: TODAY }, TZ);
    expect(page.days.map((day) => day.date)).toEqual(["2026-08-10", "2026-08-05"]);
    expect(page).toMatchObject({ nextBefore: null, reachedLimit: true });

    // 絞り込み中は、その Duty に範囲より前の記録があるかで決める
    const onlyB = await loadHistory(testDb.db, userId, { today: TODAY, dutyId: b }, TZ);
    expect(onlyB.reachedLimit).toBe(false);
    const onlyA = await loadHistory(testDb.db, userId, { today: TODAY, dutyId: a }, TZ);
    expect(onlyA.reachedLimit).toBe(true);
  });

  it("before に範囲より前の日を渡しても、範囲より前は読まない", async () => {
    await addDuty(
      "A",
      { type: "DAILY" },
      {
        createdAt: jst("2026-07-01"),
        logs: { "2026-08-04": "DONE" },
      },
    );
    const page = await loadHistory(testDb.db, userId, { today: TODAY, before: "2026-08-05" }, TZ);
    expect(page).toEqual({ days: [], nextBefore: null, reachedLimit: true });
  });

  it("絞り込みの Duty は sortOrder 順でアーカイブ済みが後ろ。範囲より前にアーカイブしたものは出さない", async () => {
    const archived = await addDuty(
      "最近アーカイブ",
      { type: "DAILY" },
      {
        archivedAt: jst("2026-10-01"),
      },
    );
    await addDuty(
      "昔アーカイブ",
      { type: "DAILY" },
      {
        createdAt: jst("2026-01-01"),
        archivedAt: jst("2026-07-01"),
      },
    );
    const active = await addDuty("今の", { type: "DAILY" });
    const options = await listHistoryDuties(testDb.db, userId, TODAY);
    expect(options.map((option) => option.id)).toEqual([active, archived]);
  });
});
