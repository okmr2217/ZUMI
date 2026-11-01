import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestD1, insertTestUser } from "@/test/d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { POST, DELETE } = await import("./route");

const ENDPOINT_A = "https://fcm.googleapis.com/fcm/send/aaa";
const ENDPOINT_B = "https://fcm.googleapis.com/fcm/send/bbb";

function subscription(endpoint: string, p256dh = "BPkey_-123", auth = "authKey") {
  return { endpoint, expirationTime: null, keys: { p256dh, auth } };
}

function request(method: "POST" | "DELETE", body: unknown) {
  return new Request("http://localhost/api/push/subscription", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function rows() {
  const { results } = await ctx.env
    .DB!.prepare("SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions ORDER BY endpoint")
    .all();
  return results;
}

let dispose: () => Promise<void>;

beforeAll(async () => {
  const d1 = await createTestD1();
  ctx.env.DB = d1.db;
  dispose = d1.dispose;
  await insertTestUser(d1.db, "alice");
  await insertTestUser(d1.db, "bob");
});

afterAll(() => dispose());

beforeEach(async () => {
  ctx.userId = "alice";
  await ctx.env.DB!.prepare("DELETE FROM push_subscriptions").run();
});

describe("POST /api/push/subscription", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    const res = await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    expect(res.status).toBe(401);
    expect(await rows()).toEqual([]);
  });

  it("購読を保存する", async () => {
    const res = await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    expect(res.status).toBe(204);
    expect(await rows()).toEqual([
      { user_id: "alice", endpoint: ENDPOINT_A, p256dh: "BPkey_-123", auth: "authKey" },
    ]);
  });

  it("同じ endpoint は1行のまま鍵を更新する", async () => {
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    await POST(request("POST", { subscription: subscription(ENDPOINT_A, "newKey", "newAuth") }));
    expect(await rows()).toEqual([
      { user_id: "alice", endpoint: ENDPOINT_A, p256dh: "newKey", auth: "newAuth" },
    ]);
  });

  it("同じブラウザで別のアカウントに切り替えたら、今のユーザーに付け替える", async () => {
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    ctx.userId = "bob";
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    expect(await rows()).toMatchObject([{ user_id: "bob", endpoint: ENDPOINT_A }]);
  });

  it("oldEndpoint を渡すと自分の古い購読を消す", async () => {
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    await POST(
      request("POST", { subscription: subscription(ENDPOINT_B), oldEndpoint: ENDPOINT_A }),
    );
    expect(await rows()).toMatchObject([{ user_id: "alice", endpoint: ENDPOINT_B }]);
  });

  it("oldEndpoint でも他のユーザーの購読は消さない", async () => {
    ctx.userId = "bob";
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    ctx.userId = "alice";
    await POST(
      request("POST", { subscription: subscription(ENDPOINT_B), oldEndpoint: ENDPOINT_A }),
    );
    expect(await rows()).toMatchObject([
      { user_id: "bob", endpoint: ENDPOINT_A },
      { user_id: "alice", endpoint: ENDPOINT_B },
    ]);
  });

  it.each([
    ["JSON でない", "not json"],
    ["subscription がない", {}],
    ["https でない endpoint", { subscription: subscription("http://example.com/push") }],
    ["URL でない endpoint", { subscription: subscription("not a url") }],
    ["鍵がない", { subscription: { endpoint: ENDPOINT_A } }],
    ["鍵が base64url でない", { subscription: subscription(ENDPOINT_A, "bad key!") }],
  ])("%s なら 400", async (_label, body) => {
    const res = await POST(request("POST", body));
    expect(res.status).toBe(400);
    expect(await rows()).toEqual([]);
  });
});

describe("DELETE /api/push/subscription", () => {
  it("自分の購読を消す", async () => {
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    const res = await DELETE(request("DELETE", { endpoint: ENDPOINT_A }));
    expect(res.status).toBe(204);
    expect(await rows()).toEqual([]);
  });

  it("他のユーザーの購読は消せない", async () => {
    ctx.userId = "bob";
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    ctx.userId = "alice";
    const res = await DELETE(request("DELETE", { endpoint: ENDPOINT_A }));
    expect(res.status).toBe(204);
    expect(await rows()).toMatchObject([{ user_id: "bob", endpoint: ENDPOINT_A }]);
  });

  it("未ログインなら 401", async () => {
    await POST(request("POST", { subscription: subscription(ENDPOINT_A) }));
    ctx.userId = null;
    const res = await DELETE(request("DELETE", { endpoint: ENDPOINT_A }));
    expect(res.status).toBe(401);
    expect(await rows()).toHaveLength(1);
  });

  it("endpoint がなければ 400", async () => {
    const res = await DELETE(request("DELETE", {}));
    expect(res.status).toBe(400);
  });
});
