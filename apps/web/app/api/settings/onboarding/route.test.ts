import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/test-d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { POST } = await import("./route");
const { needsOnboarding } = await import("@/lib/onboarding");

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/settings/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function settings(userId = "alice") {
  return ctx.env
    .DB!.prepare(
      `SELECT timezone, morning_notify_enabled, morning_notify_at, evening_notify_enabled,
        evening_notify_at, weekly_summary_enabled, weekly_summary_at, week_start, onboarded_at
       FROM user_settings WHERE user_id = ?`,
    )
    .bind(userId)
    .first();
}

let dispose: () => Promise<void>;

async function insertUser(id: string) {
  const db = ctx.env.DB!;
  await db
    .prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
    .bind(id, id, `${id}@example.com`)
    .run();
  await db
    .prepare("INSERT INTO user_settings (id, user_id) VALUES (?, ?)")
    .bind(`settings-${id}`, id)
    .run();
}

beforeAll(async () => {
  const testDb = await createTestDb();
  ctx.env.DB = testDb.db.$client;
  dispose = testDb.dispose;
});

afterAll(() => dispose());

beforeEach(async () => {
  vi.useRealTimers();
  ctx.userId = "alice";
  await ctx.env.DB!.prepare("DELETE FROM user").run();
  await insertUser("alice");
  await insertUser("bob");
});

describe("POST /api/settings/onboarding", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    const res = await post({});
    expect(res.status).toBe(401);
  });

  it("サインアップ直後はオンボーディングが必要", async () => {
    expect(await needsOnboarding("alice")).toBe(true);
  });

  it("ステップ2の値を保存し、完了日時を記録する", async () => {
    const before = Math.floor(Date.now() / 1000);
    const res = await post({
      morningNotifyEnabled: true,
      morningNotifyAt: "07:30",
      eveningNotifyEnabled: true,
      eveningNotifyAt: "22:00",
      weeklySummaryEnabled: true,
      weeklySummaryAt: "20:00",
      weekStart: 0,
    });
    expect(res.status).toBe(204);

    const row = await settings();
    expect(row).toMatchObject({
      morning_notify_enabled: 1,
      morning_notify_at: "07:30",
      evening_notify_enabled: 1,
      evening_notify_at: "22:00",
      weekly_summary_enabled: 1,
      weekly_summary_at: "20:00",
      week_start: 0,
    });
    expect(row!.onboarded_at).toBeGreaterThanOrEqual(before);
    expect(await needsOnboarding("alice")).toBe(false);
  });

  it("飛ばした（空で送った）ときは完了日時だけを記録し、設定は初期値のまま", async () => {
    const before = await settings();
    const res = await post({});
    expect(res.status).toBe(204);
    const after = await settings();
    expect(after).toEqual({ ...before, onboarded_at: expect.any(Number) });
    expect(await needsOnboarding("alice")).toBe(false);
  });

  it("2回目以降は最初の完了日時を残し、値だけを保存する", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    await post({});
    const first = (await settings())!.onboarded_at;

    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    await post({ weekStart: 0 });
    expect(await settings()).toMatchObject({ onboarded_at: first, week_start: 0 });
  });

  it("時刻を送らずに ON にしたら、未設定の時刻だけ初期値で埋める", async () => {
    await ctx.env
      .DB!.prepare("UPDATE user_settings SET evening_notify_at = '21:15' WHERE user_id = 'alice'")
      .run();
    await post({ morningNotifyEnabled: true, eveningNotifyEnabled: true });
    expect(await settings()).toMatchObject({
      morning_notify_at: "07:30",
      evening_notify_at: "21:15",
    });
  });

  it("他のユーザーの設定は変えない", async () => {
    const before = await settings("bob");
    await post({ weekStart: 0, morningNotifyEnabled: true });
    expect(await settings("bob")).toEqual(before);
    expect(await needsOnboarding("bob")).toBe(true);
  });

  it("user_settings の行がなければ作ってから記録する", async () => {
    await ctx.env.DB!.prepare("DELETE FROM user_settings WHERE user_id = 'alice'").run();
    expect(await needsOnboarding("alice")).toBe(true);
    const res = await post({ morningNotifyEnabled: true });
    expect(res.status).toBe(204);
    expect(await settings()).toMatchObject({
      timezone: "Asia/Tokyo",
      morning_notify_enabled: 1,
      morning_notify_at: "07:30",
    });
    expect(await needsOnboarding("alice")).toBe(false);
  });

  it.each([
    ["本文なし", null],
    ["不正な時刻", { morningNotifyAt: "7:30" }],
    ["月・日以外の週の始まり", { weekStart: 3 }],
    ["タイムゾーン（ブラウザから自動で取る）", { timezone: "Asia/Tokyo" }],
    ["完了日時の直接指定", { onboardedAt: 0 }],
  ])("%s なら 400 で何も変えない", async (_label, body) => {
    const before = await settings();
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await settings()).toEqual(before);
  });
});
