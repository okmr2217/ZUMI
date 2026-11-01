import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestD1, insertTestUser } from "@/test/d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { PATCH } = await import("./route");

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/settings/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function settings(userId = "alice") {
  return ctx.env
    .DB!.prepare(
      `SELECT timezone, morning_notify_enabled, morning_notify_at, evening_notify_enabled,
        evening_notify_at, weekly_summary_enabled, weekly_summary_at
       FROM user_settings WHERE user_id = ?`,
    )
    .bind(userId)
    .first();
}

let dispose: () => Promise<void>;

beforeAll(async () => {
  const d1 = await createTestD1();
  ctx.env.DB = d1.db;
  dispose = d1.dispose;
});

afterAll(() => dispose());

beforeEach(async () => {
  ctx.userId = "alice";
  await ctx.env.DB!.prepare("DELETE FROM user").run();
  await insertTestUser(ctx.env.DB!, "alice");
  await insertTestUser(ctx.env.DB!, "bob");
});

describe("PATCH /api/settings/notifications", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    const res = await patch({ morningNotifyEnabled: true });
    expect(res.status).toBe(401);
  });

  it("送った項目だけを保存し、保存後の設定を返す", async () => {
    const res = await patch({ eveningNotifyEnabled: true, eveningNotifyAt: "21:15" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      eveningNotifyEnabled: true,
      eveningNotifyAt: "21:15",
      morningNotifyEnabled: false,
      weeklySummaryEnabled: true,
      weeklySummaryAt: "20:00",
    });
    expect(await settings()).toMatchObject({
      evening_notify_enabled: 1,
      evening_notify_at: "21:15",
      morning_notify_enabled: 0,
      morning_notify_at: null,
    });
  });

  it("他のユーザーの設定は変えない", async () => {
    await patch({ weeklySummaryEnabled: false });
    expect(await settings("bob")).toMatchObject({ weekly_summary_enabled: 1 });
  });

  it("時刻が未設定のまま ON にしたら初期値で埋める", async () => {
    await patch({ morningNotifyEnabled: true, eveningNotifyEnabled: true });
    expect(await settings()).toMatchObject({
      morning_notify_at: "07:30",
      evening_notify_at: "22:00",
    });
  });

  it("設定済みの時刻は ON/OFF で消えない", async () => {
    await patch({ morningNotifyAt: "06:45" });
    await patch({ morningNotifyEnabled: true });
    await patch({ morningNotifyEnabled: false });
    expect(await settings()).toMatchObject({
      morning_notify_enabled: 0,
      morning_notify_at: "06:45",
    });
  });

  it("user_settings の行がなければ作ってから保存する", async () => {
    await ctx.env.DB!.prepare("DELETE FROM user_settings WHERE user_id = 'alice'").run();
    const res = await patch({ eveningNotifyAt: "23:00" });
    expect(res.status).toBe(200);
    expect(await settings()).toMatchObject({ evening_notify_at: "23:00", timezone: "Asia/Tokyo" });
  });

  it("タイムゾーンを正規の表記にそろえて保存する", async () => {
    const res = await patch({ timezone: "america/new_york" });
    expect(res.status).toBe(200);
    expect(await settings()).toMatchObject({ timezone: "America/New_York" });
  });

  it.each([
    ["空", {}],
    ["不正なタイムゾーン", { timezone: "Mars/Olympus" }],
    ["オフセット表記のタイムゾーン", { timezone: "+09:00" }],
    ["0埋めしない時刻", { morningNotifyAt: "7:30" }],
    ["範囲外の時刻", { eveningNotifyAt: "24:00" }],
    ["秒つきの時刻", { weeklySummaryAt: "20:00:00" }],
    ["週次の時刻を null", { weeklySummaryAt: null }],
    ["真偽値でない ON/OFF", { morningNotifyEnabled: "true" }],
    ["曜日の指定（週の最終日に固定）", { weeklySummaryWeekday: 0 }],
    ["通知以外の項目", { weekStart: 0 }],
  ])("%s なら 400 で何も変えない", async (_label, body) => {
    const before = await settings();
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await settings()).toEqual(before);
  });
});
