import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDuty } from "@/lib/duties";
import { createTestDb } from "@/lib/test-d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { PUT, DELETE } = await import("./route");

let testDb: Awaited<ReturnType<typeof createTestDb>>;
let dutyId: string;

beforeAll(async () => {
  testDb = await createTestDb();
  ctx.env.DB = testDb.db.$client;
  await testDb.createUser("alice");
  const created = await createDuty(
    testDb.db,
    "alice",
    {
      name: "プロテイン",
      icon: "cup-soda",
      scheduleConfig: { type: "DAILY" },
      notifyPrevNight: false,
      noteEnabled: false,
    },
    new Date("2026-10-01T00:00:00Z"),
  );
  if (!created.ok) throw new Error(created.error);
  dutyId = created.value.id;
});

afterAll(() => testDb.dispose());

beforeEach(async () => {
  ctx.userId = "alice";
  await ctx.env.DB!.prepare("DELETE FROM logs").run();
  await ctx.env.DB!.prepare("DELETE FROM user_settings").run();
});

function call(method: "PUT" | "DELETE", date: string, body?: unknown) {
  const request = new Request(`http://localhost/api/duties/${dutyId}/logs/${date}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const params = Promise.resolve({ id: dutyId, date });
  return method === "PUT" ? PUT(request, { params }) : DELETE(request, { params });
}

async function rows() {
  const { results } = await ctx.env
    .DB!.prepare("SELECT target_date, status FROM logs ORDER BY target_date")
    .all();
  return results;
}

describe("PUT /api/duties/:id/logs/:date", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    expect((await call("PUT", "2026-10-02", { status: "DONE" })).status).toBe(401);
    expect(await rows()).toEqual([]);
  });

  it("記録して 204", async () => {
    expect((await call("PUT", "2026-10-02", { status: "DONE" })).status).toBe(204);
    expect(await rows()).toEqual([{ target_date: "2026-10-02", status: "DONE" }]);
  });

  it.each([
    ["日付の形式が違う", "2026-1-2", { status: "DONE" }],
    ["実在しない日付", "2026-02-30", { status: "DONE" }],
    ["status が不正", "2026-10-02", { status: "done" }],
    ["余計な項目がある", "2026-10-02", { status: "DONE", userId: "bob" }],
    ["JSON でない", "2026-10-02", "not json"],
  ])("%s なら 400", async (_, date, body) => {
    const res = await call("PUT", date, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(await rows()).toEqual([]);
  });

  it("未来日は、ユーザーのタイムゾーンで判定して 400", async () => {
    // ホノルル（UTC-10）では、どの時刻でも UTC の翌日はまだ来ていない
    await ctx.env
      .DB!.prepare("INSERT INTO user_settings (id, user_id, timezone) VALUES ('s', 'alice', ?)")
      .bind("Pacific/Honolulu")
      .run();
    const utcTomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const res = await call("PUT", utcTomorrow, { status: "DONE" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_date" });
  });

  it("移し先に記録があれば 409", async () => {
    await call("PUT", "2026-10-02", { status: "DONE" });
    await call("PUT", "2026-10-03", { status: "DONE" });
    const res = await call("PUT", "2026-10-02", { status: "SKIP", moveFrom: "2026-10-03" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_logged" });
  });

  it("他ユーザーの Duty なら 404", async () => {
    ctx.userId = "mallory";
    expect((await call("PUT", "2026-10-02", { status: "DONE" })).status).toBe(404);
    expect(await rows()).toEqual([]);
  });
});

describe("DELETE /api/duties/:id/logs/:date", () => {
  it("取り消して 204。記録がなくても 204", async () => {
    await call("PUT", "2026-10-02", { status: "DONE" });
    expect((await call("DELETE", "2026-10-02")).status).toBe(204);
    expect(await rows()).toEqual([]);
    expect((await call("DELETE", "2026-10-02")).status).toBe(204);
  });

  it("未ログインなら 401", async () => {
    await call("PUT", "2026-10-02", { status: "DONE" });
    ctx.userId = null;
    expect((await call("DELETE", "2026-10-02")).status).toBe(401);
    expect(await rows()).toHaveLength(1);
  });
});
