import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { duties, logs, shareTokens } from "@zumi/db/schema";
import { eq } from "drizzle-orm";
import { loadWeeklySummary } from "./review";
import { generateShareToken, isShareToken, issueShareToken, loadShareCard } from "./share";
import { createTestDb } from "./test-d1";

const CALENDAR = { timeZone: "Asia/Tokyo", weekStart: 1 as const };
const TODAY = "2026-11-05";
const WEEK = "2026-11-02";

let testDb: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.dispose();
});

async function seedUser(id: string) {
  await testDb.createUser(id);
  await testDb.db.insert(duties).values({
    id: `${id}-daily`,
    userId: id,
    name: "プロテイン",
    icon: "cup-soda",
    scheduleType: "DAILY",
    scheduleConfig: { type: "DAILY" },
    sortOrder: 0,
    createdAt: new Date("2026-10-01T00:00:00+09:00"),
  });
  for (const targetDate of ["2026-10-27", "2026-11-02", "2026-11-03"]) {
    await testDb.db.insert(logs).values({
      id: crypto.randomUUID(),
      userId: id,
      dutyId: `${id}-daily`,
      targetDate,
      status: "DONE",
      loggedAt: new Date(`${targetDate}T21:00:00+09:00`),
    });
  }
  return id;
}

describe("シェア用トークン", () => {
  it("128bit の乱数を base64url にした22文字", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) expect(isShareToken(token)).toBe(true);
    expect(isShareToken("short")).toBe(false);
    expect(isShareToken(`${"a".repeat(21)}/`)).toBe(false);
  });

  it("画像の数字は振り返りタブの週次サマリーと同じで、Duty の id やメールアドレスは持たない", async () => {
    const userId = await seedUser("share-1");
    const { token, card } = await issueShareToken(testDb.db, userId, WEEK, TODAY, CALENDAR);
    const summary = await loadWeeklySummary(testDb.db, userId, WEEK, TODAY, CALENDAR);

    expect(card).toMatchObject({
      weekStart: summary.weekStart,
      done: summary.done,
      total: summary.total,
      diff: summary.diff,
      caption: summary.caption,
    });
    expect(card.duties).toEqual(
      summary.duties.map(({ name, icon, schedule, done, total }) => ({
        name,
        icon,
        schedule,
        done,
        total,
      })),
    );
    const stored = JSON.stringify(await loadShareCard(testDb.db, token));
    expect(stored).not.toContain(userId);
    expect(stored).not.toContain("@example.com");
  });

  it("発行した時点の数字で固定され、その後の記録では変わらない", async () => {
    const userId = await seedUser("share-2");
    const { token, card } = await issueShareToken(testDb.db, userId, WEEK, TODAY, CALENDAR);
    await testDb.db.insert(logs).values({
      id: crypto.randomUUID(),
      userId,
      dutyId: `${userId}-daily`,
      targetDate: "2026-11-04",
      status: "DONE",
      loggedAt: new Date(),
    });
    expect(await loadShareCard(testDb.db, token)).toEqual(card);
  });

  it("同じ週をシェアし直すとトークンごと作り直し、古いトークンは使えなくなる", async () => {
    const userId = await seedUser("share-3");
    const first = await issueShareToken(testDb.db, userId, WEEK, TODAY, CALENDAR);
    const second = await issueShareToken(testDb.db, userId, WEEK, TODAY, CALENDAR);
    expect(second.token).not.toBe(first.token);
    expect(await loadShareCard(testDb.db, first.token)).toBeNull();
    expect(await loadShareCard(testDb.db, second.token)).toEqual(second.card);
    const rows = await testDb.db.select().from(shareTokens).where(eq(shareTokens.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it("形の合わないトークン・存在しないトークンは null", async () => {
    expect(await loadShareCard(testDb.db, "../../etc")).toBeNull();
    expect(await loadShareCard(testDb.db, generateShareToken())).toBeNull();
  });
});
