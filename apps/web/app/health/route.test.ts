import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/test-d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database } }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));

const { GET, HEAD } = await import("./route");

let realDb: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  const testDb = await createTestDb();
  realDb = testDb.d1;
  dispose = testDb.dispose;
});

afterAll(async () => {
  await dispose();
});

describe("GET /health", () => {
  it("D1 が応答すれば 200 を返し、キャッシュさせない", async () => {
    ctx.env.DB = realDb;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", checks: { db: "ok" } });
  });

  it("D1 が失敗したら 503 を返し、エラーの中身は返さない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    ctx.env.DB = {
      prepare: () => ({ first: () => Promise.reject(new Error("D1_ERROR: secret detail")) }),
    } as unknown as D1Database;
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ status: "error", checks: { db: "error" } });
    expect(JSON.stringify(body)).not.toContain("secret detail");
  });

  it("D1 が応答しないままなら待ち続けず 503 を返す", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    ctx.env.DB = {
      prepare: () => ({ first: () => new Promise(() => {}) }),
    } as unknown as D1Database;
    const pending = GET();
    await vi.advanceTimersByTimeAsync(3000);
    expect((await pending).status).toBe(503);
    vi.useRealTimers();
  });
});

describe("HEAD /health", () => {
  it("本文なしでステータスだけ返す", async () => {
    ctx.env.DB = realDb;
    const response = await HEAD();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
