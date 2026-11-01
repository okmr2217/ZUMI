import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/test-d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { PATCH } = await import("./route");

function patch(body: unknown) {
  return PATCH(
    new Request("http://localhost/api/settings/display", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function weekStart(userId = "alice") {
  const row = await ctx.env
    .DB!.prepare("SELECT week_start FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first<{ week_start: number }>();
  return row?.week_start;
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
  ctx.userId = "alice";
  await ctx.env.DB!.prepare("DELETE FROM user").run();
  await insertUser("alice");
  await insertUser("bob");
});

describe("PATCH /api/settings/display", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    const res = await patch({ weekStart: 0 });
    expect(res.status).toBe(401);
  });

  it("初期値は月曜（1）", async () => {
    expect(await weekStart()).toBe(1);
  });

  it("週の始まりを日曜・月曜に切り替える", async () => {
    const res = await patch({ weekStart: 0 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weekStart: 0 });
    expect(await weekStart()).toBe(0);

    await patch({ weekStart: 1 });
    expect(await weekStart()).toBe(1);
  });

  it("他のユーザーの設定は変えない", async () => {
    await patch({ weekStart: 0 });
    expect(await weekStart("bob")).toBe(1);
  });

  it("user_settings の行がなければ作ってから保存する", async () => {
    await ctx.env.DB!.prepare("DELETE FROM user_settings WHERE user_id = 'alice'").run();
    const res = await patch({ weekStart: 0 });
    expect(res.status).toBe(200);
    expect(await weekStart()).toBe(0);
  });

  it.each([
    ["空", {}],
    ["月・日以外の曜日", { weekStart: 2 }],
    ["文字列", { weekStart: "0" }],
    ["null", { weekStart: null }],
    ["表示以外の項目", { weekStart: 0, timezone: "Asia/Tokyo" }],
  ])("%s なら 400 で何も変えない", async (_label, body) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await weekStart()).toBe(1);
  });
});
