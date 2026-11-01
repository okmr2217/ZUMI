import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/test-d1";

const ctx = vi.hoisted(() => ({ env: {} as { DB?: D1Database }, userId: null as string | null }));

vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: ctx.env }) }));
vi.mock("@/lib/auth", () => ({
  getServerSession: async () => (ctx.userId ? { user: { id: ctx.userId } } : null),
}));

const { POST } = await import("./route");
const { PATCH } = await import("../notifications/route");
const { POST: completeOnboarding } = await import("../onboarding/route");

/** アプリを開いたときのブラウザの値での同期（`TimezoneSync`）。 */
function sync(timezone: unknown) {
  return POST(
    new Request("http://localhost/api/settings/timezone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    }),
  );
}

/** 設定画面での変更。 */
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
    .DB!.prepare("SELECT timezone, timezone_auto FROM user_settings WHERE user_id = ?")
    .bind(userId)
    .first();
}

let dispose: () => Promise<void>;

async function insertUser(id: string, withSettings = true) {
  const db = ctx.env.DB!;
  await db
    .prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)")
    .bind(id, id, `${id}@example.com`)
    .run();
  if (withSettings) {
    await db
      .prepare("INSERT INTO user_settings (id, user_id) VALUES (?, ?)")
      .bind(`settings-${id}`, id)
      .run();
  }
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
});

describe("POST /api/settings/timezone", () => {
  it("未ログインなら 401", async () => {
    ctx.userId = null;
    expect((await sync("Europe/London")).status).toBe(401);
  });

  it("不正なタイムゾーンなら 400 で何も変えない", async () => {
    expect((await sync("Mars/Olympus")).status).toBe(400);
    expect((await sync("+09:00")).status).toBe(400);
    expect(await settings()).toEqual({ timezone: "Asia/Tokyo", timezone_auto: 1 });
  });

  it("新しい行は自動のまま始まり、ブラウザの値で上書きされる", async () => {
    expect(await settings()).toEqual({ timezone: "Asia/Tokyo", timezone_auto: 1 });
    expect((await sync("europe/london")).status).toBe(204);
    expect(await settings()).toEqual({ timezone: "Europe/London", timezone_auto: 1 });
  });

  it("オンボーディングを通ったあとも自動のまま同期される", async () => {
    const res = await completeOnboarding(
      new Request("http://localhost/api/settings/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ morningNotifyEnabled: true, weekStart: 0 }),
      }),
    );
    expect(res.status).toBe(204);
    await sync("America/New_York");
    expect(await settings()).toEqual({ timezone: "America/New_York", timezone_auto: 1 });
  });

  it("行がなければ自動として作る", async () => {
    await insertUser("bob", false);
    ctx.userId = "bob";
    await sync("America/New_York");
    expect(await settings("bob")).toEqual({ timezone: "America/New_York", timezone_auto: 1 });
  });
});

describe("タイムゾーンの自動/手動", () => {
  it("設定画面で手で選ぶと手動になり、別の端末のブラウザの値で上書きされない", async () => {
    const res = await patch({ timezone: "America/Chicago" });
    expect(await res.json()).toMatchObject({ timezone: "America/Chicago", timezoneAuto: false });
    expect(await settings()).toEqual({ timezone: "America/Chicago", timezone_auto: 0 });

    expect((await sync("Europe/London")).status).toBe(204);
    expect(await settings()).toEqual({ timezone: "America/Chicago", timezone_auto: 0 });
  });

  it("自動に戻すとその場でブラウザの値が入り、以後は同期で上書きされる", async () => {
    await patch({ timezone: "America/Chicago" });
    const res = await patch({ timezone: "Europe/London", timezoneAuto: true });
    expect(await res.json()).toMatchObject({ timezone: "Europe/London", timezoneAuto: true });
    expect(await settings()).toEqual({ timezone: "Europe/London", timezone_auto: 1 });

    await sync("Australia/Sydney");
    expect(await settings()).toEqual({ timezone: "Australia/Sydney", timezone_auto: 1 });
  });

  it("タイムゾーンに触れない変更では自動/手動は変わらない", async () => {
    await patch({ timezone: "America/Chicago" });
    await patch({ morningNotifyEnabled: true });
    expect(await settings()).toEqual({ timezone: "America/Chicago", timezone_auto: 0 });
  });

  it("タイムゾーンなしで自動/手動だけは送れない", async () => {
    expect((await patch({ timezoneAuto: true })).status).toBe(400);
    expect((await patch({ timezoneAuto: false })).status).toBe(400);
    expect(await settings()).toEqual({ timezone: "Asia/Tokyo", timezone_auto: 1 });
  });
});
