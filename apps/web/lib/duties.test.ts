import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { duties, dutyPauses, userSettings } from "@zumi/db/schema";
import { getNextDue } from "@zumi/types";
import {
  archiveDuty,
  countLimitedDuties,
  createDuty,
  getUserCalendar,
  listDuties,
  pauseDuty,
  resumeDuty,
  updateDuty,
} from "./duties";
import { DUTY_LIMIT, type DutyInput } from "./duty-input";
import { createTestDb } from "./test-d1";

const TZ = "Asia/Tokyo";

const input: DutyInput = {
  name: "お風呂",
  icon: "bath",
  scheduleConfig: { type: "SINCE_LAST", days: 2 },
  notifyPrevNight: false,
  noteEnabled: false,
};

/** 東京の日付で 2026-11-02 の 10:00 */
const NOV_2 = new Date("2026-11-02T01:00:00Z");
/** 東京では 2026-11-05 の 00:30（UTC ではまだ 11/4） */
const NOV_5_EARLY = new Date("2026-11-04T15:30:00Z");

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

async function create(overrides: Partial<DutyInput> = {}, owner = userId) {
  const result = await createDuty(testDb.db, owner, { ...input, ...overrides }, NOV_2);
  if (!result.ok) throw new Error(result.error);
  return result.value.id;
}

async function getDuty(id: string) {
  return testDb.db.select().from(duties).where(eq(duties.id, id)).get();
}

async function getPauses(id: string) {
  return testDb.db
    .select({ startDate: dutyPauses.startDate, endDate: dutyPauses.endDate })
    .from(dutyPauses)
    .where(eq(dutyPauses.dutyId, id))
    .orderBy(dutyPauses.startDate);
}

describe("createDuty", () => {
  it("scheduleType を scheduleConfig.type から決め、ACTIVE で作る", async () => {
    const id = await create({ scheduleConfig: { type: "WEEKDAYS", weekdays: [2, 5] } });
    const duty = await getDuty(id);
    expect(duty).toMatchObject({
      userId,
      name: "お風呂",
      scheduleType: "WEEKDAYS",
      scheduleConfig: { type: "WEEKDAYS", weekdays: [2, 5] },
      status: "ACTIVE",
      archivedAt: null,
      notifyPrevNight: false,
      noteEnabled: false,
    });
    expect(duty?.createdAt.getTime()).toBe(NOV_2.getTime());
  });

  it("sortOrder は作成順に増え、一覧はその順に並ぶ", async () => {
    const a = await create({ name: "A" });
    const b = await create({ name: "B" });
    const c = await create({ name: "C" });
    expect((await listDuties(testDb.db, userId)).map((d) => d.id)).toEqual([a, b, c]);
    expect((await getDuty(c))?.sortOrder).toBe(2);
  });

  it("他ユーザーの Duty は一覧に出ない", async () => {
    await create({}, otherUserId);
    expect(await listDuties(testDb.db, userId)).toEqual([]);
  });
});

describe("上限チェック", () => {
  it(`ACTIVE と PAUSED の合計が ${DUTY_LIMIT} 件に達したら作れない`, async () => {
    const ids: string[] = [];
    for (let i = 0; i < DUTY_LIMIT; i++) ids.push(await create({ name: `D${i}` }));
    await pauseDuty(testDb.db, userId, ids[0]!, NOV_2, TZ);

    expect(await countLimitedDuties(testDb.db, userId)).toBe(DUTY_LIMIT);
    const result = await createDuty(testDb.db, userId, input, NOV_2);
    expect(result).toEqual({ ok: false, error: "limit_reached" });
    expect(await listDuties(testDb.db, userId)).toHaveLength(DUTY_LIMIT);
  });

  it("アーカイブすると枠が空く（ARCHIVED は数えない）", async () => {
    const ids: string[] = [];
    for (let i = 0; i < DUTY_LIMIT; i++) ids.push(await create({ name: `D${i}` }));
    await archiveDuty(testDb.db, userId, ids[0]!, NOV_2, TZ);

    expect(await countLimitedDuties(testDb.db, userId)).toBe(DUTY_LIMIT - 1);
    expect((await createDuty(testDb.db, userId, input, NOV_2)).ok).toBe(true);
  });

  it("同時に作っても上限を超えない", async () => {
    for (let i = 0; i < DUTY_LIMIT - 1; i++) await create({ name: `D${i}` });
    const results = await Promise.all(
      Array.from({ length: 3 }, () => createDuty(testDb.db, userId, input, NOV_2)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await countLimitedDuties(testDb.db, userId)).toBe(DUTY_LIMIT);
  });

  it("他ユーザーの件数は数えない", async () => {
    for (let i = 0; i < DUTY_LIMIT; i++) await create({ name: `D${i}` }, otherUserId);
    expect((await createDuty(testDb.db, userId, input, NOV_2)).ok).toBe(true);
  });
});

describe("updateDuty", () => {
  it("編集できる項目を更新し、scheduleType も合わせる", async () => {
    const id = await create();
    const result = await updateDuty(testDb.db, userId, id, {
      name: "資源ゴミ",
      icon: "recycle",
      scheduleConfig: { type: "NTH_WEEK", weekdays: [3], every: 2, anchor: "2026-11-04" },
      notifyPrevNight: true,
      noteEnabled: true,
    });
    expect(result.ok).toBe(true);
    expect(await getDuty(id)).toMatchObject({
      name: "資源ゴミ",
      icon: "recycle",
      scheduleType: "NTH_WEEK",
      scheduleConfig: { type: "NTH_WEEK", weekdays: [3], every: 2, anchor: "2026-11-04" },
      notifyPrevNight: true,
      noteEnabled: true,
      status: "ACTIVE",
    });
  });

  it("他ユーザーの Duty は編集できない", async () => {
    const id = await create({}, otherUserId);
    expect(await updateDuty(testDb.db, userId, id, { ...input, name: "乗っ取り" })).toEqual({
      ok: false,
      error: "not_found",
    });
    expect((await getDuty(id))?.name).toBe("お風呂");
  });

  it("アーカイブ済みは編集できない", async () => {
    const id = await create();
    await archiveDuty(testDb.db, userId, id, NOV_2, TZ);
    expect(await updateDuty(testDb.db, userId, id, input)).toEqual({
      ok: false,
      error: "invalid_state",
    });
  });
});

describe("一時停止・再開", () => {
  it("一時停止した日を startDate、再開した日を endDate にした半開区間を書く", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    expect((await getDuty(id))?.status).toBe("PAUSED");
    expect(await getPauses(id)).toEqual([{ startDate: "2026-11-02", endDate: null }]);

    await resumeDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    expect((await getDuty(id))?.status).toBe("ACTIVE");
    // UTC では 11/4 だが、ユーザーのタイムゾーン（東京）では 11/5
    expect(await getPauses(id)).toEqual([{ startDate: "2026-11-02", endDate: "2026-11-05" }]);
  });

  it("書いた期間は期日計算で一時停止として扱われる", async () => {
    const id = await create({ scheduleConfig: { type: "DAILY" } });
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    const duty = (await getDuty(id))!;
    const calc = { duty, logs: [], timeZone: TZ, weekStart: 1 as const };

    expect(getNextDue({ ...calc, pauses: await getPauses(id) }, "2026-11-02")).toBeNull();
    await resumeDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    expect(getNextDue({ ...calc, pauses: await getPauses(id) }, "2026-11-02")).toEqual({
      type: "DATE",
      date: "2026-11-05",
    });
  });

  it("連打しても開いた期間は1つだけ", async () => {
    const id = await create();
    await Promise.all([
      pauseDuty(testDb.db, userId, id, NOV_2, TZ),
      pauseDuty(testDb.db, userId, id, NOV_2, TZ),
    ]);
    expect(await getPauses(id)).toHaveLength(1);
    expect(await pauseDuty(testDb.db, userId, id, NOV_2, TZ)).toEqual({
      ok: false,
      error: "invalid_state",
    });
  });

  it("一時停止した日に再開したら、長さ0の期間は残さない", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    await resumeDuty(testDb.db, userId, id, new Date("2026-11-02T10:00:00Z"), TZ);
    expect(await getPauses(id)).toEqual([]);
    expect((await getDuty(id))?.status).toBe("ACTIVE");
  });

  it("2回目の一時停止は別の期間として追加する", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    await resumeDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    await pauseDuty(testDb.db, userId, id, new Date("2026-11-10T01:00:00Z"), TZ);
    expect(await getPauses(id)).toEqual([
      { startDate: "2026-11-02", endDate: "2026-11-05" },
      { startDate: "2026-11-10", endDate: null },
    ]);
  });

  it("タイムゾーンの変更で再開日が開始日より前になったら、長さ0として消す", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, new Date("2026-11-02T00:30:00Z"), TZ); // 東京 11/2
    await resumeDuty(
      testDb.db,
      userId,
      id,
      new Date("2026-11-02T01:00:00Z"),
      "America/Los_Angeles",
    ); // LA 11/1
    expect(await getPauses(id)).toEqual([]);
  });

  it("再開できるのは一時停止中だけ", async () => {
    const id = await create();
    expect(await resumeDuty(testDb.db, userId, id, NOV_2, TZ)).toEqual({
      ok: false,
      error: "invalid_state",
    });
  });

  it("他ユーザーの Duty は一時停止・再開できない", async () => {
    const id = await create({}, otherUserId);
    expect(await pauseDuty(testDb.db, userId, id, NOV_2, TZ)).toEqual({
      ok: false,
      error: "not_found",
    });
    await pauseDuty(testDb.db, otherUserId, id, NOV_2, TZ);
    expect(await resumeDuty(testDb.db, userId, id, NOV_5_EARLY, TZ)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect((await getDuty(id))?.status).toBe("PAUSED");
    expect(await getPauses(id)).toEqual([{ startDate: "2026-11-02", endDate: null }]);
  });
});

describe("archiveDuty", () => {
  it("status を ARCHIVED にし、archivedAt を記録する", async () => {
    const id = await create();
    await archiveDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    const duty = await getDuty(id);
    expect(duty?.status).toBe("ARCHIVED");
    expect(duty?.archivedAt?.getTime()).toBe(Math.floor(NOV_5_EARLY.getTime() / 1000) * 1000);
  });

  it("一時停止中なら、開いた期間をアーカイブした日で閉じる", async () => {
    const id = await create();
    await pauseDuty(testDb.db, userId, id, NOV_2, TZ);
    await archiveDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    expect(await getPauses(id)).toEqual([{ startDate: "2026-11-02", endDate: "2026-11-05" }]);
    expect((await getDuty(id))?.status).toBe("ARCHIVED");
  });

  it("アーカイブした日から期日計算の対象外になる", async () => {
    const id = await create({ scheduleConfig: { type: "DAILY" } });
    await archiveDuty(testDb.db, userId, id, NOV_5_EARLY, TZ);
    const duty = (await getDuty(id))!;
    const calc = { duty, logs: [], pauses: [], timeZone: TZ, weekStart: 1 as const };
    expect(getNextDue(calc, "2026-11-04")).toEqual({ type: "DATE", date: "2026-11-04" });
    expect(getNextDue(calc, "2026-11-05")).toBeNull();
  });

  it("2回目のアーカイブ・他ユーザーの Duty のアーカイブは拒否する", async () => {
    const id = await create();
    await archiveDuty(testDb.db, userId, id, NOV_2, TZ);
    expect(await archiveDuty(testDb.db, userId, id, NOV_5_EARLY, TZ)).toEqual({
      ok: false,
      error: "invalid_state",
    });
    expect((await getDuty(id))?.archivedAt?.getTime()).toBe(NOV_2.getTime());

    const othersId = await create({}, otherUserId);
    expect(await archiveDuty(testDb.db, userId, othersId, NOV_2, TZ)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect((await getDuty(othersId))?.status).toBe("ACTIVE");
  });
});

describe("getUserCalendar", () => {
  it("user_settings の値を返し、行がなければ初期値を返す", async () => {
    expect(await getUserCalendar(testDb.db, userId)).toEqual({
      timeZone: "Asia/Tokyo",
      weekStart: 1,
    });
    await testDb.db
      .insert(userSettings)
      .values({ id: crypto.randomUUID(), userId, timezone: "Europe/London", weekStart: 0 });
    expect(await getUserCalendar(testDb.db, userId)).toEqual({
      timeZone: "Europe/London",
      weekStart: 0,
    });
  });
});
