import { and, asc, desc, eq, gte, inArray, isNull, notExists, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "@zumi/db/schema";
import { duties, dutyPauses, logs, userSettings } from "@zumi/db/schema";
import { addDays, toLocalDate, type WeekStart } from "@zumi/types";
import { DUTY_LIMIT, type DutyInput } from "./duty-input";

/**
 * Duty の作成・編集・一時停止・再開・アーカイブ（docs/03-duty-log-review-account.md「3-2. Duty 管理」）。
 * Route Handler から `getDb()` を渡して使う。テストでは Miniflare の D1 を渡す。
 *
 * 期日計算（`@zumi/types` の due.ts）は `duties.status` を見ず、一時停止は `duty_pauses`、
 * アーカイブは `archivedAt` で判定する。状態を変えるときは `status` と合わせて必ずこの2つも書き、
 * D1 の batch（1トランザクション）でまとめて反映する。
 */

export type Db = DrizzleD1Database<typeof schema>;

export type DutyRow = typeof duties.$inferSelect;

export type DutyError = "not_found" | "invalid_state" | "limit_reached";

export type DutyResult<T = undefined> = { ok: true; value: T } | { ok: false; error: DutyError };

const DEFAULT_TIME_ZONE = "Asia/Tokyo";

export interface UserCalendar {
  timeZone: string;
  weekStart: WeekStart;
}

/** ユーザーのタイムゾーンと週の始まり。`user_settings` の行がなければ初期値を返す */
export async function getUserCalendar(db: Db, userId: string): Promise<UserCalendar> {
  const row = await db
    .select({ timeZone: userSettings.timezone, weekStart: userSettings.weekStart })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();
  return row ?? { timeZone: DEFAULT_TIME_ZONE, weekStart: 1 };
}

/** ユーザーの Duty すべて（アーカイブ済みを含む）。並びは `sortOrder`、同じなら作成順 */
export async function listDuties(db: Db, userId: string): Promise<DutyRow[]> {
  return db
    .select()
    .from(duties)
    .where(eq(duties.userId, userId))
    .orderBy(asc(duties.sortOrder), asc(duties.createdAt));
}

/** 上限に数える Duty（ACTIVE と PAUSED）の件数 */
export async function countLimitedDuties(db: Db, userId: string): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(duties)
    .where(and(eq(duties.userId, userId), inArray(duties.status, ["ACTIVE", "PAUSED"])))
    .get();
  return row?.count ?? 0;
}

/**
 * Duty を作る。上限（ACTIVE と PAUSED で `DUTY_LIMIT` 件）に達していれば作らない。
 * 件数の確認と挿入を1文にして、連打や並行リクエストで上限を超えないようにする。
 * `sortOrder` は既存の最大値 + 1（一覧は作成順に並ぶ）。
 */
export async function createDuty(
  db: Db,
  userId: string,
  input: DutyInput,
  now: Date,
): Promise<DutyResult<{ id: string }>> {
  const id = crypto.randomUUID();
  const result = await db.run(sql`
    INSERT INTO duties (
      id, user_id, name, icon, schedule_type, schedule_config,
      notify_prev_night, note_enabled, sort_order, status, created_at
    )
    SELECT
      ${id}, ${userId}, ${input.name}, ${input.icon}, ${input.scheduleConfig.type},
      ${JSON.stringify(input.scheduleConfig)}, ${input.notifyPrevNight ? 1 : 0},
      ${input.noteEnabled ? 1 : 0},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM duties WHERE user_id = ${userId}),
      'ACTIVE', ${Math.floor(now.getTime() / 1000)}
    WHERE (
      SELECT COUNT(*) FROM duties WHERE user_id = ${userId} AND status IN ('ACTIVE', 'PAUSED')
    ) < ${DUTY_LIMIT}
  `);
  if (result.meta.changes === 0) return { ok: false, error: "limit_reached" };
  return { ok: true, value: { id } };
}

async function findOwnedDuty(db: Db, userId: string, dutyId: string) {
  return db
    .select({ status: duties.status })
    .from(duties)
    .where(and(eq(duties.id, dutyId), eq(duties.userId, userId)))
    .get();
}

/** 名前・アイコン・繰り返し・前夜通知・メモ欄を更新する。アーカイブ済みは編集できない */
export async function updateDuty(
  db: Db,
  userId: string,
  dutyId: string,
  input: DutyInput,
): Promise<DutyResult> {
  const duty = await findOwnedDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status === "ARCHIVED") return { ok: false, error: "invalid_state" };

  await db
    .update(duties)
    .set({
      name: input.name,
      icon: input.icon,
      scheduleType: input.scheduleConfig.type,
      scheduleConfig: input.scheduleConfig,
      notifyPrevNight: input.notifyPrevNight,
      noteEnabled: input.noteEnabled,
    })
    .where(
      and(
        eq(duties.id, dutyId),
        eq(duties.userId, userId),
        inArray(duties.status, ["ACTIVE", "PAUSED"]),
      ),
    );
  return { ok: true, value: undefined };
}

/**
 * 開いている一時停止期間を `today` で閉じる文。`duty_pauses` は半開区間 `[startDate, endDate)` で、
 * 閉じた日からは通常どおり。タイムゾーンの変更で `today` が `startDate` より前になった場合は
 * `startDate` にそろえ、長さ0になった期間は消す（期日計算に影響しないため）。
 */
function closeOpenPause(db: Db, userId: string, dutyId: string, today: string) {
  const owned = sql`${dutyPauses.dutyId} IN (
    SELECT id FROM duties WHERE id = ${dutyId} AND user_id = ${userId}
  )`;
  return [
    db
      .update(dutyPauses)
      .set({ endDate: sql`max(${dutyPauses.startDate}, ${today})` })
      .where(and(owned, isNull(dutyPauses.endDate))),
    db.delete(dutyPauses).where(and(owned, sql`${dutyPauses.endDate} = ${dutyPauses.startDate}`)),
  ] as const;
}

/**
 * 一時停止する。ユーザーのタイムゾーンでの今日から対象外になる（`duty_pauses.startDate` = 今日）。
 * 連打しても開いた期間が2つできないよう、開いた期間がないときだけ挿入する。
 */
export async function pauseDuty(
  db: Db,
  userId: string,
  dutyId: string,
  now: Date,
  timeZone: string,
): Promise<DutyResult> {
  const duty = await findOwnedDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status !== "ACTIVE") return { ok: false, error: "invalid_state" };

  const today = toLocalDate(now, timeZone);
  const openPause = db
    .select({ id: dutyPauses.id })
    .from(dutyPauses)
    .where(and(eq(dutyPauses.dutyId, dutyId), isNull(dutyPauses.endDate)));
  await db.batch([
    db.insert(dutyPauses).select(
      db
        .select({
          id: sql<string>`${crypto.randomUUID()}`.as("id"),
          dutyId: duties.id,
          startDate: sql<string>`${today}`.as("start_date"),
          endDate: sql<null>`NULL`.as("end_date"),
        })
        .from(duties)
        .where(
          and(
            eq(duties.id, dutyId),
            eq(duties.userId, userId),
            eq(duties.status, "ACTIVE"),
            notExists(openPause),
          ),
        ),
    ),
    db
      .update(duties)
      .set({ status: "PAUSED" })
      .where(and(eq(duties.id, dutyId), eq(duties.userId, userId), eq(duties.status, "ACTIVE"))),
  ]);
  return { ok: true, value: undefined };
}

/** 再開する。ユーザーのタイムゾーンでの今日から通常どおり（`duty_pauses.endDate` = 今日） */
export async function resumeDuty(
  db: Db,
  userId: string,
  dutyId: string,
  now: Date,
  timeZone: string,
): Promise<DutyResult> {
  const duty = await findOwnedDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status !== "PAUSED") return { ok: false, error: "invalid_state" };

  await db.batch([
    ...closeOpenPause(db, userId, dutyId, toLocalDate(now, timeZone)),
    db
      .update(duties)
      .set({ status: "ACTIVE" })
      .where(and(eq(duties.id, dutyId), eq(duties.userId, userId), eq(duties.status, "PAUSED"))),
  ]);
  return { ok: true, value: undefined };
}

/**
 * アーカイブする（Duty の削除は原則アーカイブとし、過去ログは保持する）。
 * `archivedAt` の日付から期日計算の対象外になる。一時停止中なら、その期間も今日で閉じる。
 */
export async function archiveDuty(
  db: Db,
  userId: string,
  dutyId: string,
  now: Date,
  timeZone: string,
): Promise<DutyResult> {
  const duty = await findOwnedDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status === "ARCHIVED") return { ok: false, error: "invalid_state" };

  await db.batch([
    ...closeOpenPause(db, userId, dutyId, toLocalDate(now, timeZone)),
    db
      .update(duties)
      .set({ status: "ARCHIVED", archivedAt: now })
      .where(
        and(
          eq(duties.id, dutyId),
          eq(duties.userId, userId),
          inArray(duties.status, ["ACTIVE", "PAUSED"]),
        ),
      ),
  ]);
  return { ok: true, value: undefined };
}

/**
 * 次の期日のプレビュー（`getNextDue`）に渡す、既存 Duty の一時停止期間と最近のログ。
 * `SINCE_LAST` の上限は90日なので、それより古い DONE は結果を変えない
 * （古い DONE + 日数も作成日も、どちらも今日より前になり今日に丸められる）。
 */
export async function getSchedulePreviewData(
  db: Db,
  userId: string,
  dutyIds: string[],
  today: string,
) {
  if (dutyIds.length === 0) return { pauses: [], logs: [] };
  const [pauseRows, logRows] = await Promise.all([
    db
      .select({
        dutyId: dutyPauses.dutyId,
        startDate: dutyPauses.startDate,
        endDate: dutyPauses.endDate,
      })
      .from(dutyPauses)
      .innerJoin(duties, eq(duties.id, dutyPauses.dutyId))
      .where(and(eq(duties.userId, userId), inArray(dutyPauses.dutyId, dutyIds))),
    db
      .select({ dutyId: logs.dutyId, targetDate: logs.targetDate, status: logs.status })
      .from(logs)
      .where(
        and(
          eq(logs.userId, userId),
          inArray(logs.dutyId, dutyIds),
          gte(logs.targetDate, addDays(today, -91)),
        ),
      )
      .orderBy(desc(logs.targetDate)),
  ]);
  return { pauses: pauseRows, logs: logRows };
}
