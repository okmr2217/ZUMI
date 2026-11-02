import { readdirSync, readFileSync } from "node:fs";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy, type PlatformProxy } from "wrangler";
import { getWeeklyAchievement, isDutyActiveOn } from "@zumi/types";
import { loadScheduleInputs, type ScheduleInputQuery, type ScheduleUser } from "./queries";
import * as schema from "./schema";

/**
 * 期日計算の入力の読み込み（今日タブ・振り返り・通知で共有）を、wrangler のローカル D1
 * （保存しない使い捨て）に migration を流して本物のクエリで確かめる。
 */

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

let proxy: PlatformProxy<{ DB: D1Database }>;
let d1: D1Database;

async function migrate() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(new URL(file, MIGRATIONS_DIR), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await d1.batch(statements.map((statement) => d1.prepare(statement)));
  }
}

const seconds = (iso: string) => Date.parse(iso) / 1000;
/** 2026-10-01 00:00 JST */
const CREATED_AT = seconds("2026-10-01T00:00:00+09:00");

const U1: ScheduleUser = { userId: "u1", timeZone: "Asia/Tokyo", weekStart: 1 };
const U2: ScheduleUser = { userId: "u2", timeZone: "America/New_York", weekStart: 0 };
const U3: ScheduleUser = { userId: "u3", timeZone: "Asia/Tokyo", weekStart: 1 };

// 2026年10月〜11月（月曜始まり）
//  月 火 水 木 金 土 日
//  19 20 21 22 23 24 25
//  26 27 28 29 30 31  1
//   2  3  4  5  6  7  8
const RANGE = { from: "2026-10-26", to: "2026-11-08" };

async function seed() {
  const run = (sql: string, ...params: unknown[]) => d1.prepare(sql).bind(...params);
  const user = (id: string) =>
    run(
      "insert into user (id, name, email, email_verified, created_at, updated_at) values (?, ?, ?, 1, 0, 0)",
      id,
      id,
      `${id}@example.com`,
    );
  const duty = (
    id: string,
    userId: string,
    type: string,
    config: object,
    options: { status?: string; sortOrder?: number; createdAt?: number; archivedAt?: number } = {},
  ) =>
    run(
      "insert into duties (id, user_id, name, icon, schedule_type, schedule_config, sort_order, status, created_at, archived_at) values (?, ?, ?, 'circle', ?, ?, ?, ?, ?, ?)",
      id,
      userId,
      id,
      type,
      JSON.stringify({ type, ...config }),
      options.sortOrder ?? 0,
      options.status ?? "ACTIVE",
      options.createdAt ?? CREATED_AT,
      options.archivedAt ?? null,
    );
  const log = (
    dutyId: string,
    userId: string,
    targetDate: string,
    status = "DONE",
    note: string | null = null,
  ) =>
    run(
      "insert into logs (id, user_id, duty_id, target_date, logged_at, status, note) values (?, ?, ?, ?, 0, ?, ?)",
      `${dutyId}-${targetDate}`,
      userId,
      dutyId,
      targetDate,
      status,
      note,
    );
  const pause = (dutyId: string, startDate: string, endDate: string | null) =>
    run(
      "insert into duty_pauses (id, duty_id, start_date, end_date) values (?, ?, ?, ?)",
      `${dutyId}-${startDate}`,
      dutyId,
      startDate,
      endDate,
    );

  await d1.batch([
    user("u1"),
    user("u2"),
    user("u3"),

    // 並びは sortOrder、同じなら作成順
    duty("protein", "u1", "DAILY", {}, { sortOrder: 2 }),
    log("protein", "u1", "2026-10-25"),
    log("protein", "u1", "2026-10-26"),
    log("protein", "u1", "2026-11-08", "SKIP", "雨"),
    log("protein", "u1", "2026-11-09"),

    // SINCE_LAST: 範囲より前の DONE は 10/20・10/24（10/25 は SKIP）
    duty("bath", "u1", "SINCE_LAST", { days: 2 }, { sortOrder: 1 }),
    log("bath", "u1", "2026-10-20"),
    log("bath", "u1", "2026-10-24"),
    log("bath", "u1", "2026-10-25", "SKIP"),
    log("bath", "u1", "2026-11-03"),
    // 範囲の初日ちょうどの DONE は範囲内のログとして読み、前回 DONE には数えない
    duty("edge", "u1", "SINCE_LAST", { days: 3 }, { sortOrder: 1, createdAt: CREATED_AT + 1 }),
    log("edge", "u1", "2026-10-22"),
    log("edge", "u1", "2026-10-26"),
    duty("never", "u1", "SINCE_LAST", { days: 3 }, { sortOrder: 3 }),

    // 10/28〜10/29 が一時停止（10/30 に再開）。範囲より前の一時停止期間も読む
    duty("paused-past", "u1", "DAILY", {}, { sortOrder: 4 }),
    pause("paused-past", "2026-10-28", "2026-10-30"),
    pause("paused-past", "2026-10-05", "2026-10-07"),
    log("paused-past", "u1", "2026-10-27"),
    log("paused-past", "u1", "2026-10-28"),
    log("paused-past", "u1", "2026-10-30"),
    // 一時停止中（status = PAUSED）
    duty("paused-now", "u1", "DAILY", {}, { sortOrder: 5, status: "PAUSED" }),
    pause("paused-now", "2026-11-04", null),

    // アーカイブ（11/5 10:00 JST・10/1 JST）
    duty(
      "archived-recent",
      "u1",
      "DAILY",
      {},
      {
        sortOrder: 6,
        status: "ARCHIVED",
        archivedAt: seconds("2026-11-05T10:00:00+09:00"),
      },
    ),
    pause("archived-recent", "2026-10-29", "2026-10-31"),
    log("archived-recent", "u1", "2026-11-04"),
    duty(
      "archived-old",
      "u1",
      "SINCE_LAST",
      { days: 2 },
      {
        sortOrder: 7,
        status: "ARCHIVED",
        archivedAt: seconds("2026-10-10T10:00:00+09:00"),
      },
    ),
    log("archived-old", "u1", "2026-10-05"),

    // 11/3 05:00 JST に作成。範囲の途中で作った Duty も読む
    duty(
      "created-later",
      "u1",
      "DAILY",
      {},
      {
        sortOrder: 8,
        createdAt: seconds("2026-11-03T05:00:00+09:00"),
      },
    ),
    log("created-later", "u1", "2026-11-03"),

    // 他のユーザーの Duty・ログ
    duty("other", "u2", "SINCE_LAST", { days: 2 }),
    log("other", "u2", "2026-10-20"),
    log("other", "u2", "2026-10-30"),
    duty("other-weekly", "u2", "WEEKLY_COUNT", { timesPerWeek: 2 }, { sortOrder: 1 }),
    log("other-weekly", "u2", "2026-11-01"),
  ]);
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: new URL("../wrangler.toml", import.meta.url).pathname,
    persist: false,
  });
  d1 = proxy.env.DB;
  await migrate();
  await seed();
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

const load = (query: Partial<ScheduleInputQuery> = {}) =>
  loadScheduleInputs(drizzle(d1, { schema }), { users: [U1], ...RANGE, ...query });

const find = async (id: string, query?: Partial<ScheduleInputQuery>) => {
  const row = (await load(query)).find((row) => row.duty.id === id);
  if (!row) throw new Error(`${id} が読まれていない`);
  return row;
};

/** 11/5 より十分前（振り返り・通知が渡すような、範囲の初日より前の時刻） */
const ARCHIVED_SINCE = new Date("2026-10-24T00:00:00Z");

describe("loadScheduleInputs", () => {
  it("アーカイブ済みを除いた Duty を sortOrder・作成順で返す（一時停止中を含む）", async () => {
    expect((await load()).map((row) => row.duty.id)).toEqual([
      "bath",
      "edge",
      "protein",
      "never",
      "paused-past",
      "paused-now",
      "created-later",
    ]);
  });

  it("Duty の行と、ユーザーのカレンダー設定をそのまま期日計算の入力にする", async () => {
    const { duty, schedule } = await find("protein");
    expect(schedule.duty).toBe(duty);
    expect(duty.createdAt).toEqual(new Date(CREATED_AT * 1000));
    expect(duty.scheduleConfig).toEqual({ type: "DAILY" });
    expect(schedule).toMatchObject({ timeZone: "Asia/Tokyo", weekStart: 1 });
  });

  it("ログは範囲内（from〜to の両端を含む）だけ。rangeLogs にはメモも付ける", async () => {
    const { schedule, rangeLogs } = await find("protein");
    expect(schedule.logs).toEqual([
      { dutyId: "protein", targetDate: "2026-10-26", status: "DONE" },
      { dutyId: "protein", targetDate: "2026-11-08", status: "SKIP" },
    ]);
    expect(rangeLogs).toEqual([
      { dutyId: "protein", targetDate: "2026-10-26", status: "DONE", note: null },
      { dutyId: "protein", targetDate: "2026-11-08", status: "SKIP", note: "雨" },
    ]);
  });

  describe("SINCE_LAST の前回 DONE", () => {
    it("範囲より前の最新の DONE を schedule.logs に足す（SKIP は起点にしない）", async () => {
      const { schedule, rangeLogs } = await find("bath");
      expect(schedule.logs).toEqual([
        { dutyId: "bath", targetDate: "2026-11-03", status: "DONE" },
        { targetDate: "2026-10-24", status: "DONE" },
      ]);
      // rangeLogs には足さない（その日の記録として画面に出さないため）
      expect(rangeLogs.map((log) => log.targetDate)).toEqual(["2026-11-03"]);
    });

    it("範囲の初日ちょうどの DONE は範囲内のログで、前回 DONE はそれより前から探す", async () => {
      expect((await find("edge")).schedule.logs).toEqual([
        { dutyId: "edge", targetDate: "2026-10-26", status: "DONE" },
        { targetDate: "2026-10-22", status: "DONE" },
      ]);
    });

    it("DONE が1件もなければ足さない。SINCE_LAST 以外には足さない", async () => {
      expect((await find("never")).schedule.logs).toEqual([]);
      // protein（DAILY）には 10/25 の DONE があるが足さない
      expect((await find("protein")).schedule.logs.map((log) => log.targetDate)).not.toContain(
        "2026-10-25",
      );
    });

    it("アーカイブ済みの SINCE_LAST にも、読む対象なら足す", async () => {
      const { schedule } = await find("archived-old", {
        archivedSince: new Date("2026-10-01T00:00:00Z"),
      });
      expect(schedule.logs).toEqual([{ targetDate: "2026-10-05", status: "DONE" }]);
    });
  });

  describe("一時停止", () => {
    it("その Duty の一時停止期間をすべて返す（範囲より前の期間も）", async () => {
      // 並びは決めていない（期日計算はどの期間に入るかしか見ない）
      const { pauses } = (await find("paused-past")).schedule;
      expect([...pauses].sort((a, b) => a.startDate.localeCompare(b.startDate))).toEqual([
        { dutyId: "paused-past", startDate: "2026-10-05", endDate: "2026-10-07" },
        { dutyId: "paused-past", startDate: "2026-10-28", endDate: "2026-10-30" },
      ]);
      expect((await find("paused-now")).schedule.pauses).toEqual([
        { dutyId: "paused-now", startDate: "2026-11-04", endDate: null },
      ]);
    });

    it("半開区間 [startDate, endDate) で期日計算に効く", async () => {
      const { schedule } = await find("paused-past");
      expect(isDutyActiveOn(schedule, "2026-10-27")).toBe(true);
      expect(isDutyActiveOn(schedule, "2026-10-28")).toBe(false);
      expect(isDutyActiveOn(schedule, "2026-10-29")).toBe(false);
      expect(isDutyActiveOn(schedule, "2026-10-30")).toBe(true);
      // 10/26〜11/1 の7日から一時停止の2日を除いた5日。10/28（一時停止中）の済は数えない
      expect(getWeeklyAchievement(schedule, "2026-10-26", "2026-11-08")).toEqual({
        done: 2,
        total: 5,
      });
    });
  });

  describe("アーカイブ", () => {
    it("archivedSince を渡すと、それ以降にアーカイブした Duty も読む", async () => {
      const ids = (await load({ archivedSince: ARCHIVED_SINCE })).map((row) => row.duty.id);
      expect(ids).toContain("archived-recent");
      expect(ids).not.toContain("archived-old");
      // アーカイブしていない Duty（一時停止中を含む）はそのまま読む
      expect(ids).toEqual(expect.arrayContaining(["bath", "protein", "paused-now"]));
    });

    it("archivedAt がちょうど archivedSince の Duty も読む", async () => {
      const ids = (await load({ archivedSince: new Date("2026-11-05T10:00:00+09:00") })).map(
        (row) => row.duty.id,
      );
      expect(ids).toContain("archived-recent");
    });

    it("アーカイブした日から期日計算の対象外になる。一時停止期間とログも読む", async () => {
      const { schedule } = await find("archived-recent", { archivedSince: ARCHIVED_SINCE });
      expect(schedule.duty.archivedAt).toEqual(new Date("2026-11-05T10:00:00+09:00"));
      expect(schedule.pauses).toEqual([
        { dutyId: "archived-recent", startDate: "2026-10-29", endDate: "2026-10-31" },
      ]);
      expect(schedule.logs).toEqual([
        { dutyId: "archived-recent", targetDate: "2026-11-04", status: "DONE" },
      ]);
      expect(isDutyActiveOn(schedule, "2026-11-04")).toBe(true);
      expect(isDutyActiveOn(schedule, "2026-11-05")).toBe(false);
      // 11/2〜11/8 のうち有効なのは 11/2〜11/4 の3日
      expect(getWeeklyAchievement(schedule, "2026-11-02", "2026-11-08")).toEqual({
        done: 1,
        total: 3,
      });
    });
  });

  it("作成日より前の日は期日計算の対象外（Duty は範囲の途中で作ったものも読む）", async () => {
    const { schedule } = await find("created-later");
    expect(isDutyActiveOn(schedule, "2026-11-02")).toBe(false);
    expect(isDutyActiveOn(schedule, "2026-11-03")).toBe(true);
    // 11/2〜11/8 のうち、作成日の 11/3 から今日（11/5）までの3日
    expect(getWeeklyAchievement(schedule, "2026-11-02", "2026-11-05")).toEqual({
      done: 1,
      total: 3,
    });
    // 範囲が作成日より前で終わっても読む（今日タブで作成前の過去日を開いた場合）。対象外かは期日計算が決める
    const before = await find("created-later", { from: "2026-10-26", to: "2026-11-01" });
    expect(before.schedule.logs).toEqual([]);
    expect(isDutyActiveOn(before.schedule, "2026-11-01")).toBe(false);
  });

  describe("複数ユーザー", () => {
    it("ユーザーごとの Duty・ログ・カレンダー設定で返し、他のユーザーの分は混ざらない", async () => {
      const rows = await load({ users: [U1, U2, U3] });
      const byUser = (userId: string) =>
        rows.filter((row) => row.duty.userId === userId).map((row) => row.duty.id);
      expect(byUser("u1")).toEqual((await load()).map((row) => row.duty.id));
      expect(byUser("u2")).toEqual(["other", "other-weekly"]);
      expect(byUser("u3")).toEqual([]);

      const other = rows.find((row) => row.duty.id === "other")!;
      expect(other.schedule).toMatchObject({ timeZone: "America/New_York", weekStart: 0 });
      expect(other.schedule.logs).toEqual([
        { dutyId: "other", targetDate: "2026-10-30", status: "DONE" },
        { targetDate: "2026-10-20", status: "DONE" },
      ]);
      // 1人ずつ読んだときと同じ
      expect(rows.filter((row) => row.duty.userId === "u1")).toEqual(await load());
      expect(rows.filter((row) => row.duty.userId === "u2")).toEqual(await load({ users: [U2] }));
    });

    it("ユーザーが多くてもバインド変数の上限に当たらない", async () => {
      const users = [
        ...Array.from({ length: 150 }, (_, i) => ({ ...U3, userId: `missing-${i}` })),
        U2,
      ];
      expect((await load({ users })).map((row) => row.duty.id)).toEqual(["other", "other-weekly"]);
    });

    it("ユーザーがいなければクエリを投げずに空", async () => {
      const { db, queries } = recordQueries(d1);
      expect(await loadScheduleInputs(drizzle(db, { schema }), { users: [], ...RANGE })).toEqual(
        [],
      );
      expect(queries).toEqual([]);
    });
  });
});

/**
 * 実際に投げたクエリを記録する D1。drizzle は `prepare(sql).bind(...params)` で文を作り、
 * `batch` でまとめて投げるため、その3つを横取りして控える
 */
function recordQueries(target: D1Database) {
  const queries: { sql: string; params: unknown[] }[] = [];
  let batches = 0;
  const db = new Proxy(target, {
    get(d1, prop) {
      if (prop === "batch") {
        return (statements: Parameters<D1Database["batch"]>[0]) => {
          batches++;
          return d1.batch(statements);
        };
      }
      if (prop !== "prepare") return Reflect.get(d1, prop, d1);
      return (query: string) => {
        const statement = d1.prepare(query);
        return new Proxy(statement, {
          get(stmt, key) {
            if (key === "bind") {
              return (...params: unknown[]) => {
                queries.push({ sql: query, params });
                return stmt.bind(...params);
              };
            }
            const value = Reflect.get(stmt, key, stmt);
            return typeof value === "function" ? value.bind(stmt) : value;
          },
        });
      };
    },
  });
  return { db, queries, batches: () => batches };
}

async function queryPlan(query: { sql: string; params: unknown[] }) {
  const { results } = await d1
    .prepare(`explain query plan ${query.sql}`)
    .bind(...query.params)
    .all<{ detail: string }>();
  return results.map((row) => row.detail);
}

// 通知は毎分、全ユーザー分を読みうるため、人数によらず1往復・全件を読まないこと（D1 は読んだ行数で課金される）
describe("クエリ回数とインデックス", () => {
  it.each([
    ["1人", [U1]],
    ["複数", [U1, U2, U3]],
  ])("%s: 4本を batch 1回で投げ、どれも user_id のインデックスで引く", async (_, users) => {
    for (const archivedSince of [undefined, ARCHIVED_SINCE]) {
      const { db, queries, batches } = recordQueries(d1);
      await loadScheduleInputs(drizzle(db, { schema }), { users, ...RANGE, archivedSince });
      expect(batches()).toBe(1);
      expect(queries).toHaveLength(4);
      for (const query of queries) {
        const plan = await queryPlan(query);
        const scans = plan.filter((detail) => /^SCAN (duties|logs|duty_pauses)\b/.test(detail));
        expect(scans, query.sql).toEqual([]);
      }
      const [dutyPlan, , logPlan] = await Promise.all(queries.map(queryPlan));
      expect(dutyPlan!.join("\n")).toContain("duties_user_status_idx");
      expect(logPlan!.join("\n")).toContain("logs_user_date_idx");
    }
  });
});
