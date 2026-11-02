import {
  and,
  asc,
  eq,
  getTableName,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { DutyLog, DutyScheduleInput, WeekStart } from "@zumi/types";
import * as schema from "./schema";
import { duties, dutyPauses, logs } from "./schema";

/**
 * web・notify で共有するクエリの部品。期日計算の入力を読むクエリが両者でずれると、
 * 「通知は来たのに画面に出ていない」不整合になるため、同じ部品を使う。
 */

/**
 * 相関サブクエリから外側の `duties.id` を指す参照。drizzle は単一テーブルの select 句で
 * 列名からテーブル名を省くため、`${duties.id}` のままだと内側の `logs.id` と解決されてしまう
 */
const OUTER_DUTY_ID = sql`${sql.identifier(getTableName(duties))}.${sql.identifier(duties.id.name)}`;

/**
 * `before` より前の最新の DONE の対象日（なければ null）。`duties` を from にした select の列に使う。
 * `SINCE_LAST` の期日計算は、読み込んだ期間より前の前回 DONE が欠けると「DONE が1件もない」とみなすため、
 * 期間のログと合わせてこれも読む（`DutyScheduleInput.logs`）。
 * Duty ごとに (duty_id, target_date) のインデックスを新しい順にたどり、最初の DONE だけを読む。
 */
export const lastDoneBefore = (before: string) =>
  sql<string | null>`(
    select ${logs.targetDate} from ${logs}
    where ${logs.dutyId} = ${OUTER_DUTY_ID}
      and ${logs.status} = 'DONE'
      and ${logs.targetDate} < ${before}
    order by ${logs.targetDate} desc
    limit 1
  )`;

// ---- 期日計算の入力 ----

export type ScheduleDb = DrizzleD1Database<typeof schema>;

export type ScheduleDutyRow = typeof duties.$inferSelect;

/** 読むユーザーと、そのカレンダー設定（`DutyScheduleInput` の `timeZone`・`weekStart` になる） */
export interface ScheduleUser {
  userId: string;
  timeZone: string;
  weekStart: WeekStart;
}

export interface ScheduleInputQuery {
  users: readonly ScheduleUser[];
  /** ログを読む範囲（両端を含む）。`SINCE_LAST` には `from` より前の最新の DONE も足す */
  from: string;
  to: string;
  /**
   * 省略すると、アーカイブ済みの Duty は読まない（`status` が ACTIVE・PAUSED のもの。今日タブ）。
   * 渡すと、アーカイブ済みのうち `archivedAt` がこの時刻以降のものも読む（振り返り・通知。
   * 範囲内の有効な日の分を数えるため）。範囲より前にアーカイブした Duty は期日計算に効かないので、
   * 範囲の初日の0時より確実に前の時刻を渡せば結果は変わらず、読む行だけ減らせる
   */
  archivedSince?: Date;
}

/** 範囲内のログ。`SINCE_LAST` の前回 DONE は含まない */
export type RangeLog = Pick<DutyLog, "dutyId" | "targetDate" | "status" | "note">;

export interface ScheduleInputRow {
  duty: ScheduleDutyRow;
  /**
   * 期日計算の入力。`logs` は範囲内のログ（メモを除く）と、`SINCE_LAST` では範囲より前の最新の DONE。
   * `pauses` はその Duty の一時停止期間すべて（期間では絞らない）
   */
  schedule: DutyScheduleInput;
  /** 範囲内のログ（メモ付き）。その日の記録を画面に出すときに使う */
  rangeLogs: RangeLog[];
}

/**
 * ユーザー（1人でも複数でも）の Duty と期日計算の入力を読む。並びは `sortOrder`、同じなら作成順
 * （複数ユーザーなら、ユーザーごとに `duty.userId` で分けて使う）。
 *
 * 4本のクエリ（Duty・一時停止期間・範囲のログ・`SINCE_LAST` の前回 DONE）を D1 の batch で1往復にまとめる。
 * 人数によらず4本のままで、ユーザー ID は JSON 1つで渡すため、D1 のバインド変数の上限（1文 100 個）にも当たらない。
 * 作成日・一時停止・アーカイブの日付での絞り込みは期日計算（`@zumi/types`）に任せ、ここでは行わない。
 */
export async function loadScheduleInputs(
  db: ScheduleDb,
  query: ScheduleInputQuery,
): Promise<ScheduleInputRow[]> {
  const calendars = new Map(query.users.map((user) => [user.userId, user]));
  if (calendars.size === 0) return [];
  const userIds = [...calendars.keys()];
  const byUser = (column: typeof duties.userId | typeof logs.userId): SQL =>
    userIds.length === 1
      ? eq(column, userIds[0]!)
      : sql`${column} in (select value from json_each(${JSON.stringify(userIds)}))`;
  const selected = and(
    byUser(duties.userId),
    query.archivedSince
      ? or(isNull(duties.archivedAt), gte(duties.archivedAt, query.archivedSince))
      : inArray(duties.status, ["ACTIVE", "PAUSED"]),
  );

  const [dutyRows, pauseRows, logRows, lastDoneRows] = await db.batch([
    db.select().from(duties).where(selected).orderBy(asc(duties.sortOrder), asc(duties.createdAt)),
    db
      .select({
        dutyId: dutyPauses.dutyId,
        startDate: dutyPauses.startDate,
        endDate: dutyPauses.endDate,
      })
      .from(dutyPauses)
      .innerJoin(duties, eq(duties.id, dutyPauses.dutyId))
      .where(selected),
    db
      .select({
        dutyId: logs.dutyId,
        targetDate: logs.targetDate,
        status: logs.status,
        note: logs.note,
      })
      .from(logs)
      .where(
        and(byUser(logs.userId), gte(logs.targetDate, query.from), lte(logs.targetDate, query.to)),
      ),
    db
      .select({ dutyId: duties.id, targetDate: lastDoneBefore(query.from) })
      .from(duties)
      .where(and(selected, eq(duties.scheduleType, "SINCE_LAST"))),
  ]);

  return dutyRows.map((duty) => {
    const calendar = calendars.get(duty.userId)!;
    const rangeLogs = logRows.filter((log) => log.dutyId === duty.id);
    const scheduleLogs: Pick<DutyLog, "dutyId" | "targetDate" | "status">[] = rangeLogs.map(
      ({ dutyId, targetDate, status }) => ({ dutyId, targetDate, status }),
    );
    const lastDone = lastDoneRows.find((row) => row.dutyId === duty.id)?.targetDate;
    return {
      duty,
      schedule: {
        duty,
        logs: lastDone ? [...scheduleLogs, { targetDate: lastDone, status: "DONE" }] : scheduleLogs,
        pauses: pauseRows.filter((pause) => pause.dutyId === duty.id),
        timeZone: calendar.timeZone,
        weekStart: calendar.weekStart,
      },
      rangeLogs,
    };
  });
}
