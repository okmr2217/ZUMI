import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { createD1Store, type NotifyStore } from "./store";

/**
 * D1 のクエリそのものの確認。wrangler のローカル D1（保存しない使い捨て）に
 * packages/db の migration を流し、`createD1Store` を本物のクエリで動かす。
 */

const MIGRATIONS_DIR = join(import.meta.dirname, "../../../packages/db/migrations");

let proxy: PlatformProxy<{ DB: D1Database }>;
let db: D1Database;
let store: NotifyStore;

async function migrate() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await db.batch(statements.map((statement) => db.prepare(statement)));
  }
}

/** 2026-10-01 00:00 JST（秒） */
const CREATED_AT = Date.parse("2026-10-01T00:00:00+09:00") / 1000;
const NOW = new Date("2026-11-08T11:00:00Z");

async function seed() {
  const run = (sql: string, ...params: unknown[]) => db.prepare(sql).bind(...params);
  const user = (id: string) =>
    run(
      "insert into user (id, name, email, email_verified, created_at, updated_at) values (?, ?, ?, 1, 0, 0)",
      id,
      id,
      `${id}@example.com`,
    );
  const settings = (userId: string, columns: Record<string, unknown>) => {
    const names = ["id", "user_id", ...Object.keys(columns)];
    return run(
      `insert into user_settings (${names.join(", ")}) values (${names.map(() => "?").join(", ")})`,
      `s-${userId}`,
      userId,
      ...Object.values(columns),
    );
  };
  const duty = (id: string, userId: string, type: string, config: object, archivedAt?: number) =>
    run(
      "insert into duties (id, user_id, name, icon, schedule_type, schedule_config, sort_order, created_at, archived_at) values (?, ?, ?, 'circle', ?, ?, 0, ?, ?)",
      id,
      userId,
      id,
      type,
      JSON.stringify({ type, ...config }),
      CREATED_AT,
      archivedAt ?? null,
    );
  const log = (dutyId: string, userId: string, targetDate: string, status = "DONE") =>
    run(
      "insert into logs (id, user_id, duty_id, target_date, logged_at, status) values (?, ?, ?, ?, 0, ?)",
      `${dutyId}-${targetDate}`,
      userId,
      dutyId,
      targetDate,
      status,
    );

  await db.batch([
    user("u1"),
    user("u2"),
    user("u3"),
    settings("u1", { morning_notify_enabled: 1, morning_notify_at: "08:00" }),
    // 朝はオフでも、週次サマリーの時刻が一致すれば拾う
    settings("u2", {
      timezone: "America/New_York",
      morning_notify_at: "08:00",
      weekly_summary_at: "09:00",
      week_start: 0,
    }),
    // 夜の時刻が一致しない・週次はオフ
    settings("u3", {
      evening_notify_enabled: 1,
      evening_notify_at: "21:00",
      weekly_summary_enabled: 0,
      weekly_summary_at: "08:00",
    }),

    duty("bath", "u1", "SINCE_LAST", { days: 2 }),
    log("bath", "u1", "2026-10-20"),
    log("bath", "u1", "2026-10-24"),
    log("bath", "u1", "2026-10-25", "SKIP"),
    log("bath", "u1", "2026-11-03"),
    duty("never", "u1", "SINCE_LAST", { days: 3 }),
    duty("protein", "u1", "DAILY", {}),
    log("protein", "u1", "2026-10-25"),
    log("protein", "u1", "2026-10-26"),
    log("protein", "u1", "2026-11-08", "SKIP"),
    log("protein", "u1", "2026-11-09"),
    duty("paused", "u1", "DAILY", {}),
    run(
      "insert into duty_pauses (id, duty_id, start_date, end_date) values ('p1', 'paused', '2026-11-04', null)",
    ),
    // アーカイブから15日以内なら読む（週の途中でアーカイブした分を数えるため）
    duty("archived-recent", "u1", "DAILY", {}, Date.parse("2026-11-05T00:00:00Z") / 1000),
    duty("archived-old", "u1", "DAILY", {}, Date.parse("2026-10-01T00:00:00Z") / 1000),
    // 他のユーザーの Duty・ログは混ざらない
    duty("other", "u2", "SINCE_LAST", { days: 2 }),
    log("other", "u2", "2026-10-30"),

    run(
      "insert into push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values ('sub1', 'u1', 'https://push.example.com/1', 'k1', 'a1', 0), ('sub2', 'u1', 'https://push.example.com/2', 'k2', 'a2', 0), ('sub3', 'u2', 'https://push.example.com/3', 'k3', 'a3', 0)",
    ),
  ]);
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false });
  db = proxy.env.DB;
  await migrate();
  await seed();
  store = createD1Store(db);
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

describe("findSettingsAt", () => {
  it("有効な通知の時刻が候補に含まれる設定だけを返す", async () => {
    const rows = await store.findSettingsAt(["08:00", "09:00"]);
    expect(rows.map((row) => row.userId).sort()).toEqual(["u1", "u2"]);
    expect(rows.find((row) => row.userId === "u2")).toEqual({
      userId: "u2",
      timezone: "America/New_York",
      morningNotifyEnabled: false,
      morningNotifyAt: "08:00",
      eveningNotifyEnabled: false,
      eveningNotifyAt: null,
      weeklySummaryEnabled: true,
      weeklySummaryAt: "09:00",
      weekStart: 0,
    });
  });

  it("候補が多くてもバインド変数の上限に当たらない", async () => {
    const times = Array.from(
      { length: 96 },
      (_, i) =>
        `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`,
    );
    const rows = await store.findSettingsAt(times);
    expect(rows.map((row) => row.userId).sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("候補がなければ空", async () => {
    expect(await store.findSettingsAt([])).toEqual([]);
    expect(await store.findSettingsAt(["12:34"])).toEqual([]);
  });
});

describe("loadDuties", () => {
  const load = () =>
    store.loadDuties(
      { userId: "u1", timezone: "Asia/Tokyo", weekStart: 1 },
      "2026-10-26",
      "2026-11-08",
      NOW,
    );

  it("ユーザーの Duty を、一時停止中・最近アーカイブしたものも含めて返す", async () => {
    const duties = await load();
    expect(duties.map((duty) => duty.name).sort()).toEqual([
      "archived-recent",
      "bath",
      "never",
      "paused",
      "protein",
    ]);
    const paused = duties.find((duty) => duty.name === "paused")!;
    expect(paused.schedule.pauses).toEqual([
      { dutyId: "paused", startDate: "2026-11-04", endDate: null },
    ]);
    expect(paused.schedule.duty.createdAt).toEqual(new Date(CREATED_AT * 1000));
    expect(paused.schedule.duty.scheduleConfig).toEqual({ type: "DAILY" });
    expect(paused.schedule).toMatchObject({ timeZone: "Asia/Tokyo", weekStart: 1 });
  });

  it("ログは範囲内（rangeStart〜today）だけ", async () => {
    const protein = (await load()).find((duty) => duty.name === "protein")!;
    expect(protein.schedule.logs).toEqual([
      { dutyId: "protein", targetDate: "2026-10-26", status: "DONE" },
      { dutyId: "protein", targetDate: "2026-11-08", status: "SKIP" },
    ]);
  });

  it("SINCE_LAST には範囲より前の最新の DONE を足す（SKIP は起点にしない）", async () => {
    const duties = await load();
    const bath = duties.find((duty) => duty.name === "bath")!;
    expect(bath.schedule.logs).toEqual([
      { dutyId: "bath", targetDate: "2026-11-03", status: "DONE" },
      { targetDate: "2026-10-24", status: "DONE" },
    ]);
    // DONE が1件もなければ足さない
    expect(duties.find((duty) => duty.name === "never")!.schedule.logs).toEqual([]);
  });

  it("Duty がなければ空", async () => {
    expect(
      await store.loadDuties(
        { userId: "u3", timezone: "Asia/Tokyo", weekStart: 1 },
        "2026-10-26",
        "2026-11-08",
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("購読", () => {
  it("ユーザーの購読を返し、削除できる", async () => {
    expect((await store.listSubscriptions("u1")).map((sub) => sub.id).sort()).toEqual([
      "sub1",
      "sub2",
    ]);
    await store.deleteSubscription("sub1");
    expect(await store.listSubscriptions("u1")).toEqual([
      { id: "sub2", endpoint: "https://push.example.com/2", p256dh: "k2", auth: "a2" },
    ]);
    expect(await store.listSubscriptions("u2")).toHaveLength(1);
  });
});
