import { and, eq, inArray, sql } from "drizzle-orm";
import { loadScheduleInputs } from "@zumi/db/queries";
import { duties, logs } from "@zumi/db/schema";
import {
  getWeekRange,
  toLocalDate,
  type DutyLog,
  type DutyScheduleInput,
  type LogStatus,
} from "@zumi/types";
import type { Db, DutyRow, UserCalendar } from "./duties";
import type { LogInput } from "./log-input";

/**
 * 記録（Log）の読み書き（docs/03-duty-log-review-account.md「記録操作」「3-3. 記録（Log）」）。
 *
 * `(dutyId, targetDate)` のユニーク制約に upsert して、連打や再送で二重にならないようにする。
 * 所有者・状態の確認は書き込みの文の条件にも入れ、確認と書き込みの間に状態が変わっても他人の
 * Duty やアーカイブ済みの Duty には書かない。
 */

export type LogError = "not_found" | "invalid_state" | "invalid_date" | "already_logged";

export type LogResult = { ok: true } | { ok: false; error: LogError };

const toTimestamp = (date: Date) => Math.floor(date.getTime() / 1000);

async function findRecordableDuty(db: Db, userId: string, dutyId: string) {
  return db
    .select({ status: duties.status, createdAt: duties.createdAt })
    .from(duties)
    .where(and(eq(duties.id, dutyId), eq(duties.userId, userId)))
    .get();
}

/**
 * Duty の状態と対象日を確かめる。
 * - アーカイブ済みは記録できない（Duty タブでも閲覧だけ）。一時停止中は記録できる
 *   （一時停止中に付いた DONE も `SINCE_LAST` の起点に使う。docs/03「期日計算の境界ルール」）
 * - 今日より後の日（未来日は「確認のみ」）と、作成日より前の日には記録できない
 */
async function checkRecordable(
  db: Db,
  userId: string,
  dutyId: string,
  dates: string[],
  now: Date,
  timeZone: string,
): Promise<LogResult> {
  const duty = await findRecordableDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status === "ARCHIVED") return { ok: false, error: "invalid_state" };
  const today = toLocalDate(now, timeZone);
  const createdDate = toLocalDate(duty.createdAt, timeZone);
  if (dates.some((date) => date > today || date < createdDate)) {
    return { ok: false, error: "invalid_date" };
  }
  return { ok: true };
}

/** 書き込み先の Duty の条件。所有者が一致し、アーカイブしていない */
const recordableDuty = (userId: string, dutyId: string) =>
  sql`FROM duties WHERE id = ${dutyId} AND user_id = ${userId} AND status <> 'ARCHIVED'`;

/**
 * `targetDate` に済・スキップを記録する。同じ日にログがあれば状態を上書きする（冪等）。
 * `note` は送られたときだけ書き換え、Duty の `noteEnabled` が false なら保存しない。
 *
 * `moveFrom` があれば対象日の変更として、その日のログを `targetDate` に移す。
 * 移し先にすでにログがあれば何も変えずに `already_logged` を返す（別の日の記録を黙って上書きしないため）。
 */
export async function recordLog(
  db: Db,
  userId: string,
  dutyId: string,
  targetDate: string,
  input: LogInput,
  now: Date,
  timeZone: string,
): Promise<LogResult> {
  const moveFrom = input.moveFrom !== targetDate ? input.moveFrom : undefined;
  const check = await checkRecordable(
    db,
    userId,
    dutyId,
    moveFrom ? [targetDate, moveFrom] : [targetDate],
    now,
    timeZone,
  );
  if (!check.ok) return check;

  const id = crypto.randomUUID();
  const loggedAt = toTimestamp(now);
  const noteGiven = input.note !== undefined;
  const note = input.note ?? null;

  if (!moveFrom) {
    const result = await db.run(sql`
      INSERT INTO logs (id, user_id, duty_id, target_date, logged_at, status, note)
      SELECT ${id}, user_id, id, ${targetDate}, ${loggedAt}, ${input.status},
        CASE WHEN note_enabled = 1 THEN ${note} ELSE NULL END
      ${recordableDuty(userId, dutyId)}
      ON CONFLICT (duty_id, target_date) DO UPDATE SET
        status = excluded.status,
        logged_at = excluded.logged_at,
        note = CASE WHEN ${noteGiven ? 1 : 0} = 1 THEN excluded.note ELSE logs.note END
    `);
    // 確認の後にアーカイブされた場合だけ、SELECT が0行になり何も書かれない
    return result.meta.changes === 0 ? { ok: false, error: "invalid_state" } : { ok: true };
  }

  // 移し先への挿入（衝突したら何もしない）→ 挿入できたときだけ元の日を消す、を1トランザクションで
  // （D1 の batch には `db.run` を入れられないため、クエリビルダーで書く）
  const previousNote = sql`(SELECT note FROM logs WHERE duty_id = ${dutyId} AND target_date = ${moveFrom})`;
  const [inserted] = await db.batch([
    db
      .insert(logs)
      .select(
        db
          .select({
            id: sql<string>`${id}`.as("id"),
            userId: duties.userId,
            dutyId: duties.id,
            targetDate: sql<string>`${targetDate}`.as("target_date"),
            loggedAt: sql<number>`${loggedAt}`.as("logged_at"),
            status: sql<LogStatus>`${input.status}`.as("status"),
            note: sql<string | null>`CASE WHEN ${duties.noteEnabled} = 1
              THEN ${noteGiven ? sql`${note}` : previousNote} ELSE NULL END`.as("note"),
          })
          .from(duties)
          .where(
            and(
              eq(duties.id, dutyId),
              eq(duties.userId, userId),
              inArray(duties.status, ["ACTIVE", "PAUSED"]),
            ),
          ),
      )
      .onConflictDoNothing({ target: [logs.dutyId, logs.targetDate] }),
    db
      .delete(logs)
      .where(
        and(
          eq(logs.dutyId, dutyId),
          eq(logs.userId, userId),
          eq(logs.targetDate, moveFrom),
          sql`EXISTS (SELECT 1 FROM logs WHERE id = ${id})`,
        ),
      ),
  ]);
  if (inserted.meta.changes > 0) return { ok: true };
  const target = await db
    .select({ id: logs.id })
    .from(logs)
    .where(and(eq(logs.dutyId, dutyId), eq(logs.targetDate, targetDate)))
    .get();
  return { ok: false, error: target ? "already_logged" : "invalid_state" };
}

/** 記録を取り消す（誤タップのリカバリ）。ログがなくても成功にする（冪等） */
export async function deleteLog(
  db: Db,
  userId: string,
  dutyId: string,
  targetDate: string,
): Promise<LogResult> {
  const duty = await findRecordableDuty(db, userId, dutyId);
  if (!duty) return { ok: false, error: "not_found" };
  if (duty.status === "ARCHIVED") return { ok: false, error: "invalid_state" };
  await db
    .delete(logs)
    .where(and(eq(logs.dutyId, dutyId), eq(logs.userId, userId), eq(logs.targetDate, targetDate)));
  return { ok: true };
}

export interface DayDuty {
  duty: DutyRow;
  /** 期日計算の入力。`logs` は `date` を含む週の初日〜`date` と、`SINCE_LAST` の前回 DONE */
  schedule: DutyScheduleInput;
  /** `date` 当日のログ */
  log: Pick<DutyLog, "status" | "note"> | null;
}

/**
 * 今日タブで `date` を開いたときの Duty（アーカイブ済みを除く）と期日計算の入力。並びは `sortOrder` 順。
 * 読み込みは notify・振り返りと同じ `loadScheduleInputs`（D1 の batch で1往復）。
 */
export async function loadDayDuties(
  db: Db,
  userId: string,
  date: string,
  calendar: UserCalendar,
): Promise<DayDuty[]> {
  const rows = await loadScheduleInputs(db, {
    users: [{ userId, ...calendar }],
    from: getWeekRange(date, calendar.weekStart).start,
    to: date,
  });
  return rows.map(({ duty, schedule, rangeLogs }) => {
    const log = rangeLogs.find((row) => row.targetDate === date);
    return { duty, schedule, log: log ? { status: log.status, note: log.note } : null };
  });
}
