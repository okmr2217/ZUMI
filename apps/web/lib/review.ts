import { and, asc, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { lastDoneBefore } from "@zumi/db/queries";
import { duties, dutyPauses, logs } from "@zumi/db/schema";
import {
  addDays,
  getDaysInMonth,
  getWeekRange,
  getWeekday,
  getWeeklyAchievement,
  toLocalDate,
  type DutyLog,
  type DutyScheduleInput,
  type LogStatus,
  type WeekStart,
} from "@zumi/types";
import type { Db, DutyRow, UserCalendar } from "./duties";
import { summarizeSchedule } from "./schedule-text";

/**
 * 振り返りタブ（docs/03-duty-log-review-account.md「3-4. 振り返り・シェア」、docs/04「4-2. 振り返り」）。
 *
 * 達成率は `@zumi/types` の `getWeeklyAchievement` を Duty ごとに合計するだけで、画面側で独自の判定は書かない
 * （週次通知（apps/notify の `summarizeWeek`）と同じ数字にするため）。
 */

// ---- 無料プランの履歴3ヶ月制限（docs/06-billing.md）----

/**
 * 無料プランで見られる最古の日。ユーザーのタイムゾーンでの今日から暦で3ヶ月前の同じ日（その日を含む）。
 * その月に同じ日がなければ月末に丸める（5/31 → 2/28）。課金が入るまでは全員が無料プランの制約下で使う
 */
export function getHistoryStartDate(today: string): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const monthIndex = y * 12 + (m - 1) - 3;
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = Math.min(d, getDaysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 日付（ユーザーのタイムゾーン）の0時より確実に前の時刻。タイムゾーンは UTC+14 まであるため1日引く */
const instantBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000);

// ---- 週次サマリー ----

/** 週次サマリーの Duty ごとの内訳 */
export interface WeeklySummaryDuty {
  id: string;
  name: string;
  icon: string;
  /** 繰り返しの要約（「火・金」「前回から2日空いたら」） */
  schedule: string;
  done: number;
  total: number;
}

/**
 * 週次サマリーカードに出す値（S10 のシェア画像もこの型から描く）。
 * 前週との差分は済んだ数（分子）の差（docs/03「3-4」。週次通知の「先週より +N」と同じ定義）
 */
export interface WeeklySummary {
  /** 週の初日・最終日（ユーザー設定の週の始まりで区切る） */
  weekStart: string;
  weekEnd: string;
  /** 「第N週」。週の4日目が属する ISO 週番号（月曜始まりなら ISO 8601 の週番号と一致する） */
  weekNumber: number;
  /** 今日を含む週か（集計は今日の時点まで） */
  isCurrentWeek: boolean;
  done: number;
  total: number;
  /** 前の週の済んだ数 */
  previousDone: number;
  /** `done - previousDone` */
  diff: number;
  /** カードの一言 */
  caption: string;
  /** 分母が 0 の Duty（その週に期日がない・まるごと一時停止など）は除く。並びは `sortOrder` 順 */
  duties: WeeklySummaryDuty[];
}

/** `date` が属する ISO 週番号 */
export function getIsoWeekNumber(date: string): number {
  // ISO 週はその週の木曜が属する年で数える
  const thursday = addDays(date, 3 - ((getWeekday(date) + 6) % 7));
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = (Date.parse(thursday) - Date.parse(jan1)) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

function summaryCaption(done: number, total: number, isCurrentWeek: boolean): string {
  const week = isCurrentWeek ? "今週" : "この週";
  if (total === 0) return `${week}の予定はありません`;
  const ratio = done / total;
  if (ratio >= 1) return `${week}の義務、ぜんぶ済ませた`;
  if (ratio >= 0.7) return `${week}の義務、だいたい済ませた`;
  if (ratio >= 0.4) return `${week}の義務、半分ほど済ませた`;
  return isCurrentWeek ? "今週の義務、ひとつずつ" : "この週は、ひと休み";
}

export interface SummaryDuty {
  duty: Pick<DutyRow, "id" | "name" | "icon" | "scheduleConfig">;
  schedule: DutyScheduleInput;
}

/**
 * `weekDate` を含む週のサマリー（純粋関数）。`today` より後の日は数えない。
 * `summaryDuties` の `logs` には前の週の初日から週末までの分と、`SINCE_LAST` ではそれより前の最新の DONE も含めること。
 */
export function buildWeeklySummary(
  summaryDuties: readonly SummaryDuty[],
  weekDate: string,
  today: string,
  weekStart: WeekStart,
): WeeklySummary {
  const week = getWeekRange(weekDate, weekStart);
  const previousWeekDate = addDays(week.start, -7);
  let done = 0;
  let total = 0;
  let previousDone = 0;
  const breakdown: WeeklySummaryDuty[] = [];
  for (const { duty, schedule } of summaryDuties) {
    const achievement = getWeeklyAchievement(schedule, week.start, today);
    previousDone += getWeeklyAchievement(schedule, previousWeekDate, today).done;
    done += achievement.done;
    total += achievement.total;
    if (achievement.total === 0) continue;
    breakdown.push({
      id: duty.id,
      name: duty.name,
      icon: duty.icon,
      schedule: summarizeSchedule(duty.scheduleConfig, weekStart),
      ...achievement,
    });
  }
  const isCurrentWeek = week.start <= today && today <= week.end;
  return {
    weekStart: week.start,
    weekEnd: week.end,
    weekNumber: getIsoWeekNumber(addDays(week.start, 3)),
    isCurrentWeek,
    done,
    total,
    previousDone,
    diff: done - previousDone,
    caption: summaryCaption(done, total, isCurrentWeek),
    duties: breakdown,
  };
}

/**
 * 週次サマリーの入力を読む。一時停止・アーカイブした Duty も含める（その週の有効な日の分は数えるため）。
 * 前の週の初日より前にアーカイブした Duty は、どちらの週にも数えないので読まない。
 * 4本のクエリを D1 の batch で1往復にまとめる。
 */
export async function loadSummaryDuties(
  db: Db,
  userId: string,
  weekDate: string,
  calendar: UserCalendar,
): Promise<SummaryDuty[]> {
  const week = getWeekRange(weekDate, calendar.weekStart);
  const rangeStart = addDays(week.start, -7);
  const relevant = and(
    eq(duties.userId, userId),
    or(isNull(duties.archivedAt), gte(duties.archivedAt, instantBefore(rangeStart))),
  );
  const [dutyRows, pauseRows, logRows, lastDoneRows] = await db.batch([
    db.select().from(duties).where(relevant).orderBy(asc(duties.sortOrder), asc(duties.createdAt)),
    db
      .select({
        dutyId: dutyPauses.dutyId,
        startDate: dutyPauses.startDate,
        endDate: dutyPauses.endDate,
      })
      .from(dutyPauses)
      .innerJoin(duties, eq(duties.id, dutyPauses.dutyId))
      .where(relevant),
    db
      .select({ dutyId: logs.dutyId, targetDate: logs.targetDate, status: logs.status })
      .from(logs)
      .where(
        and(
          eq(logs.userId, userId),
          gte(logs.targetDate, rangeStart),
          lte(logs.targetDate, week.end),
        ),
      ),
    // SINCE_LAST の前回 DONE（前の週より前の最新の DONE）
    db
      .select({ dutyId: duties.id, targetDate: lastDoneBefore(rangeStart) })
      .from(duties)
      .where(and(relevant, eq(duties.scheduleType, "SINCE_LAST"))),
  ]);

  return dutyRows.map((duty) => {
    const dutyLogs: Pick<DutyLog, "targetDate" | "status">[] = logRows.filter(
      (log) => log.dutyId === duty.id,
    );
    const lastDone = lastDoneRows.find((row) => row.dutyId === duty.id)?.targetDate;
    if (lastDone) dutyLogs.push({ targetDate: lastDone, status: "DONE" });
    return {
      duty,
      schedule: {
        duty,
        logs: dutyLogs,
        pauses: pauseRows.filter((pause) => pause.dutyId === duty.id),
        timeZone: calendar.timeZone,
        weekStart: calendar.weekStart,
      },
    };
  });
}

export async function loadWeeklySummary(
  db: Db,
  userId: string,
  weekDate: string,
  today: string,
  calendar: UserCalendar,
): Promise<WeeklySummary> {
  const summaryDuties = await loadSummaryDuties(db, userId, weekDate, calendar);
  return buildWeeklySummary(summaryDuties, weekDate, today, calendar.weekStart);
}

// ---- 履歴 ----

/** 1回に読む日数。日付グループの途中でページが切れないよう、件数ではなく日数で区切る */
export const HISTORY_PAGE_DAYS = 14;

export interface HistoryEntry {
  dutyId: string;
  name: string;
  icon: string;
  status: LogStatus;
  note: string | null;
  /** 記録した時刻（「7:42」）。対象日と別の日に記録したときは日付も付ける（「11/3 7:42」） */
  loggedTime: string;
}

export interface HistoryDay {
  date: string;
  entries: HistoryEntry[];
}

export interface HistoryPage {
  /** 新しい日付から順。期日でない日に付いた記録・アーカイブ済みの Duty の記録も含む */
  days: HistoryDay[];
  /** 続きを読むときの `before`。続きがなければ null */
  nextBefore: string | null;
  /** 続きがなく、かつ無料プランの範囲より前にも記録がある（制限に達した） */
  reachedLimit: boolean;
}

export interface HistoryQuery {
  today: string;
  /** この日より前を読む（含まない）。省略すると今日から */
  before?: string;
  /** Duty で絞り込む */
  dutyId?: string;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function formatLoggedTime(loggedAt: Date, targetDate: string, timeZone: string): string {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
    });
    timeFormatters.set(timeZone, formatter);
  }
  // hourCycle: h23 では時がゼロ埋めされるため、数値に戻す（モックは「7:42」）
  const parts = formatter.formatToParts(loggedAt);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const time = `${Number(part("hour"))}:${part("minute")}`;
  const loggedDate = toLocalDate(loggedAt, timeZone);
  if (loggedDate === targetDate) return time;
  const [, m, d] = loggedDate.split("-").map(Number) as [number, number, number];
  return `${m}/${d} ${time}`;
}

/**
 * 履歴を `HISTORY_PAGE_DAYS` 日分読む。無料プランの範囲（`getHistoryStartDate`）より前は読まない。
 * 日付ごとの中は Duty の `sortOrder` 順。3本のクエリを D1 の batch で1往復にまとめる。
 */
export async function loadHistory(
  db: Db,
  userId: string,
  query: HistoryQuery,
  timeZone: string,
): Promise<HistoryPage> {
  const start = getHistoryStartDate(query.today);
  const before = query.before ?? addDays(query.today, 1);
  const dutyFilter = query.dutyId ? eq(logs.dutyId, query.dutyId) : undefined;
  const inRange = and(
    eq(logs.userId, userId),
    gte(logs.targetDate, start),
    lt(logs.targetDate, before),
    dutyFilter,
  );
  // このページに入る日付。1日多く読み、その日があれば続きがある（その日の分は次のページで出す）
  const pageDates = db
    .selectDistinct({ date: logs.targetDate })
    .from(logs)
    .where(inRange)
    .orderBy(desc(logs.targetDate))
    .limit(HISTORY_PAGE_DAYS + 1)
    .as("page_dates");

  const [entryRows, olderRows] = await db.batch([
    db
      .select({
        targetDate: logs.targetDate,
        status: logs.status,
        note: logs.note,
        loggedAt: logs.loggedAt,
        dutyId: duties.id,
        name: duties.name,
        icon: duties.icon,
      })
      .from(logs)
      .innerJoin(duties, eq(duties.id, logs.dutyId))
      .where(
        and(inRange, sql`${logs.targetDate} >= (select min(${pageDates.date}) from ${pageDates})`),
      )
      .orderBy(desc(logs.targetDate), asc(duties.sortOrder), asc(duties.createdAt)),
    // 範囲より前の記録があるか（制限に達したことを出すため）
    db
      .select({ one: sql<number>`1` })
      .from(logs)
      .where(and(eq(logs.userId, userId), lt(logs.targetDate, start), dutyFilter))
      .limit(1),
  ]);

  const days: HistoryDay[] = [];
  for (const row of entryRows) {
    let day = days.at(-1);
    if (day?.date !== row.targetDate) {
      day = { date: row.targetDate, entries: [] };
      days.push(day);
    }
    day.entries.push({
      dutyId: row.dutyId,
      name: row.name,
      icon: row.icon,
      status: row.status,
      note: row.note,
      loggedTime: formatLoggedTime(row.loggedAt, row.targetDate, timeZone),
    });
  }
  const hasMore = days.length > HISTORY_PAGE_DAYS;
  if (hasMore) days.pop();
  return {
    days,
    nextBefore: hasMore ? days.at(-1)!.date : null,
    reachedLimit: !hasMore && olderRows.length > 0,
  };
}

export interface HistoryDutyOption {
  id: string;
  name: string;
  icon: string;
}

/**
 * 履歴の絞り込みに出す Duty。並びは `sortOrder` 順で、アーカイブ済みは後ろ。
 * アーカイブ済みは、履歴の範囲内に記録が残りうるもの（範囲の初日以降にアーカイブしたもの）だけ
 */
export async function listHistoryDuties(
  db: Db,
  userId: string,
  today: string,
): Promise<HistoryDutyOption[]> {
  return db
    .select({ id: duties.id, name: duties.name, icon: duties.icon })
    .from(duties)
    .where(
      and(
        eq(duties.userId, userId),
        or(
          isNull(duties.archivedAt),
          gte(duties.archivedAt, instantBefore(getHistoryStartDate(today))),
        ),
      ),
    )
    .orderBy(sql`${duties.archivedAt} is not null`, asc(duties.sortOrder), asc(duties.createdAt));
}
