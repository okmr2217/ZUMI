import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { logs } from "@zumi/db/schema";
import { archiveDuty, createDuty, pauseDuty } from "./duties";
import type { DutyInput } from "./duty-input";
import { deleteLog, loadDayDuties, recordLog } from "./logs";
import { buildTodayItems } from "./today";
import { createTestDb } from "./test-d1";

const TZ = "Asia/Tokyo";
const CALENDAR = { timeZone: TZ, weekStart: 1 as const };

/** 東京の日付で 2026-11-02（月）の 10:00。Duty はこの時刻に作る */
const NOV_2 = new Date("2026-11-02T01:00:00Z");
/** 東京では 2026-11-05（木）の 00:30（UTC ではまだ 11/4） */
const NOV_5_EARLY = new Date("2026-11-04T15:30:00Z");

const input: DutyInput = {
  name: "お風呂",
  icon: "bath",
  scheduleConfig: { type: "SINCE_LAST", days: 2 },
  notifyPrevNight: false,
  noteEnabled: false,
};

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let userId: string;
let otherUserId: string;
let userCount = 0;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.dispose();
});

beforeEach(async () => {
  userCount++;
  userId = await testDb.createUser(`user-${userCount}`);
  otherUserId = await testDb.createUser(`other-${userCount}`);
});

async function create(overrides: Partial<DutyInput> = {}, owner = userId, now = NOV_2) {
  const result = await createDuty(testDb.db, owner, { ...input, ...overrides }, now);
  if (!result.ok) throw new Error(result.error);
  return result.value.id;
}

async function getLogs(dutyId: string) {
  return testDb.db
    .select({
      targetDate: logs.targetDate,
      status: logs.status,
      note: logs.note,
      userId: logs.userId,
    })
    .from(logs)
    .where(eq(logs.dutyId, dutyId))
    .orderBy(logs.targetDate);
}

const record = (
  dutyId: string,
  date: string,
  body: Parameters<typeof recordLog>[4],
  now = NOV_5_EARLY,
  owner = userId,
) => recordLog(testDb.db, owner, dutyId, date, body, now, TZ);

describe("recordLog", () => {
  it("DONE を記録する。同じ日に何度送っても1件のまま（冪等）", async () => {
    const id = await create();
    expect(await record(id, "2026-11-04", { status: "DONE" })).toEqual({ ok: true });
    expect(await record(id, "2026-11-04", { status: "DONE" })).toEqual({ ok: true });
    expect(await getLogs(id)).toEqual([
      { targetDate: "2026-11-04", status: "DONE", note: null, userId },
    ]);
  });

  it("連打で同時に届いても二重にならない", async () => {
    const id = await create();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => record(id, "2026-11-04", { status: "DONE" })),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await getLogs(id)).toHaveLength(1);
  });

  it("スキップを記録でき、同じ日の記録は上書きされる", async () => {
    const id = await create();
    await record(id, "2026-11-04", { status: "DONE" });
    await record(id, "2026-11-04", { status: "SKIP" });
    expect(await getLogs(id)).toMatchObject([{ targetDate: "2026-11-04", status: "SKIP" }]);
  });

  it("メモは送ったときだけ書き換え、ワンタップの押印では消さない", async () => {
    const id = await create({ noteEnabled: true });
    await record(id, "2026-11-04", { status: "SKIP", note: "出張" });
    await record(id, "2026-11-04", { status: "DONE" });
    expect(await getLogs(id)).toMatchObject([{ status: "DONE", note: "出張" }]);
    await record(id, "2026-11-04", { status: "DONE", note: null });
    expect(await getLogs(id)).toMatchObject([{ status: "DONE", note: null }]);
  });

  it("noteEnabled が false の Duty にはメモを保存しない", async () => {
    const id = await create({ noteEnabled: false });
    await record(id, "2026-11-04", { status: "DONE", note: "メモ" });
    expect(await getLogs(id)).toMatchObject([{ note: null }]);
  });

  it("他ユーザーの Duty には記録できない", async () => {
    const id = await create({}, otherUserId);
    expect(await record(id, "2026-11-04", { status: "DONE" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await getLogs(id)).toEqual([]);
  });

  it("アーカイブ済みの Duty には記録できない", async () => {
    const id = await create();
    await archiveDuty(testDb.db, userId, id, NOV_2, TZ);
    expect(await record(id, "2026-11-01", { status: "DONE" })).toEqual({
      ok: false,
      error: "invalid_state",
    });
  });

  it("一時停止中の Duty には記録できる", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    expect(await record(id, "2026-11-04", { status: "DONE" })).toEqual({ ok: true });
  });

  it("今日（ユーザーのタイムゾーン）までは記録でき、未来日には記録できない", async () => {
    const id = await create();
    // UTC ではまだ 11/4 だが、東京では 11/5
    expect(await record(id, "2026-11-05", { status: "DONE" })).toEqual({ ok: true });
    expect(await record(id, "2026-11-06", { status: "DONE" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
  });

  it("作成日より前には記録できない", async () => {
    const id = await create();
    expect(await record(id, "2026-11-01", { status: "DONE" })).toEqual({
      ok: false,
      error: "invalid_date",
    });
    expect(await record(id, "2026-11-02", { status: "DONE" })).toEqual({ ok: true });
  });
});

describe("recordLog（対象日の変更）", () => {
  it("その日のログを別の日に移す。状態は送った値、メモは引き継ぐ", async () => {
    const id = await create({ noteEnabled: true });
    await record(id, "2026-11-05", { status: "DONE", note: "夜に入った" });
    expect(await record(id, "2026-11-04", { status: "DONE", moveFrom: "2026-11-05" })).toEqual({
      ok: true,
    });
    expect(await getLogs(id)).toMatchObject([
      { targetDate: "2026-11-04", status: "DONE", note: "夜に入った" },
    ]);
  });

  it("移し先にログがあれば何も変えずに already_logged", async () => {
    const id = await create();
    await record(id, "2026-11-04", { status: "SKIP" });
    await record(id, "2026-11-05", { status: "DONE" });
    expect(await record(id, "2026-11-04", { status: "DONE", moveFrom: "2026-11-05" })).toEqual({
      ok: false,
      error: "already_logged",
    });
    expect(await getLogs(id)).toMatchObject([
      { targetDate: "2026-11-04", status: "SKIP" },
      { targetDate: "2026-11-05", status: "DONE" },
    ]);
  });

  it("元の日にログがなければ、移し先に記録するだけ", async () => {
    const id = await create();
    expect(await record(id, "2026-11-03", { status: "DONE", moveFrom: "2026-11-05" })).toEqual({
      ok: true,
    });
    expect(await getLogs(id)).toMatchObject([{ targetDate: "2026-11-03", status: "DONE" }]);
  });

  it("未来日・作成日より前には移せない", async () => {
    const id = await create();
    await record(id, "2026-11-05", { status: "DONE" });
    for (const date of ["2026-11-06", "2026-11-01"]) {
      expect(await record(id, date, { status: "DONE", moveFrom: "2026-11-05" })).toEqual({
        ok: false,
        error: "invalid_date",
      });
    }
    expect(await getLogs(id)).toMatchObject([{ targetDate: "2026-11-05" }]);
  });

  it("他ユーザーの Duty のログは移せない", async () => {
    const id = await create({}, otherUserId);
    await record(id, "2026-11-05", { status: "DONE" }, NOV_5_EARLY, otherUserId);
    expect(await record(id, "2026-11-04", { status: "DONE", moveFrom: "2026-11-05" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await getLogs(id)).toMatchObject([{ targetDate: "2026-11-05", userId: otherUserId }]);
  });
});

describe("deleteLog", () => {
  it("記録を取り消す。ログがなくても成功する（冪等）", async () => {
    const id = await create();
    await record(id, "2026-11-04", { status: "DONE" });
    expect(await deleteLog(testDb.db, userId, id, "2026-11-04")).toEqual({ ok: true });
    expect(await getLogs(id)).toEqual([]);
    expect(await deleteLog(testDb.db, userId, id, "2026-11-04")).toEqual({ ok: true });
  });

  it("他の日のログは消さない", async () => {
    const id = await create();
    await record(id, "2026-11-03", { status: "DONE" });
    await record(id, "2026-11-04", { status: "DONE" });
    await deleteLog(testDb.db, userId, id, "2026-11-04");
    expect(await getLogs(id)).toMatchObject([{ targetDate: "2026-11-03" }]);
  });

  it("他ユーザーの Duty のログは消せない", async () => {
    const id = await create({}, otherUserId);
    await record(id, "2026-11-04", { status: "DONE" }, NOV_5_EARLY, otherUserId);
    expect(await deleteLog(testDb.db, userId, id, "2026-11-04")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await getLogs(id)).toHaveLength(1);
  });

  it("アーカイブ済みの Duty のログは消せない", async () => {
    const id = await create();
    await record(id, "2026-11-04", { status: "DONE" });
    await archiveDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    expect(await deleteLog(testDb.db, userId, id, "2026-11-04")).toEqual({
      ok: false,
      error: "invalid_state",
    });
    expect(
      await testDb.db
        .select()
        .from(logs)
        .where(and(eq(logs.dutyId, id), eq(logs.targetDate, "2026-11-04"))),
    ).toHaveLength(1);
  });
});

describe("loadDayDuties + buildTodayItems", () => {
  const items = async (date: string) =>
    buildTodayItems(await loadDayDuties(testDb.db, userId, date, CALENDAR), date, 1);

  it("SINCE_LAST は週より前の前回 DONE から「最後から N 日」を出す", async () => {
    // 10/20 に作成し、10/29（前の週）に済
    const id = await create({}, userId, new Date("2026-10-20T01:00:00Z"));
    await record(id, "2026-10-29", { status: "DONE" }, NOV_2);
    expect(await items("2026-11-02")).toMatchObject([
      { id, section: "SOON", detail: "最後から4日", log: null },
    ]);
  });

  it("当日に済ませても同じセクションのまま、log だけが変わる", async () => {
    const weekly = await create({
      name: "英語学習",
      scheduleConfig: { type: "WEEKLY_COUNT", timesPerWeek: 1 },
    });
    const bath = await create();
    await record(weekly, "2026-11-04", { status: "DONE" });
    await record(bath, "2026-11-04", { status: "DONE" });
    expect(await items("2026-11-04")).toMatchObject([
      { id: bath, section: "SOON", detail: "前回の記録なし", log: { status: "DONE" } },
      { id: weekly, section: "THIS_WEEK", detail: "あと1回・日曜まで", log: { status: "DONE" } },
    ]);
    // 翌日は今週の分が済んでいるので出ず、お風呂は最後から1日でまだ出ない
    expect(await items("2026-11-05")).toEqual([]);
  });

  it("「今日」「そろそろ」「今週」の順に並べ、セクション内は sortOrder 順", async () => {
    const weekly = await create({ scheduleConfig: { type: "WEEKLY_COUNT", timesPerWeek: 2 } });
    const bath = await create();
    const protein = await create({ scheduleConfig: { type: "DAILY" } });
    const trash = await create({ scheduleConfig: { type: "WEEKDAYS", weekdays: [1, 4] } });
    expect((await items("2026-11-02")).map((item) => [item.id, item.detail])).toEqual([
      [protein, "毎日"],
      [trash, "月・木"],
      [bath, "前回の記録なし"],
      [weekly, "あと2回・日曜まで"],
    ]);
  });

  it("一時停止中・アーカイブ済み・他ユーザーの Duty は出さない", async () => {
    const paused = await create({ scheduleConfig: { type: "DAILY" } });
    const archived = await create({ scheduleConfig: { type: "DAILY" } });
    await create({ scheduleConfig: { type: "DAILY" } }, otherUserId);
    await pauseDuty(testDb.db, userId, paused, NOV_2, TZ);
    await archiveDuty(testDb.db, userId, archived, NOV_2, TZ);
    expect(await items("2026-11-02")).toEqual([]);
  });

  it("期日でない日でもログがあれば、セクションなし（null）で最後に出す", async () => {
    const trash = await create({ scheduleConfig: { type: "WEEKDAYS", weekdays: [1, 4] } });
    const protein = await create({ scheduleConfig: { type: "DAILY" } });
    // 火曜はゴミ出しの期日ではないが、対象日の変更などで記録が付いている
    await record(trash, "2026-11-03", { status: "DONE" });
    expect(await items("2026-11-03")).toMatchObject([
      { id: protein, section: "TODAY", log: null },
      { id: trash, section: null, detail: "月・木", log: { status: "DONE" } },
    ]);
  });

  it("その日のメモを返す", async () => {
    const id = await create({ noteEnabled: true, scheduleConfig: { type: "DAILY" } });
    await record(id, "2026-11-03", { status: "SKIP", note: "雨" });
    expect(await items("2026-11-03")).toMatchObject([
      { id, noteEnabled: true, createdDate: "2026-11-02", log: { status: "SKIP", note: "雨" } },
    ]);
  });
});
