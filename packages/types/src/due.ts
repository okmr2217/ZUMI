import { addDays, diffInDays, getDaysInMonth, getWeekRange, getWeekday, toLocalDate } from "./date";
import type { Duty, DutyLog, DutyPause, LogStatus, WeekStart } from "./duty";
import { isFixedDueSchedule, type ScheduleConfig } from "./schedule";

/**
 * 期日計算（docs/03-duty-log-review-account.md「期日計算の境界ルール（2026/11 確定）」
 * 「達成率の分母」、docs/02-notifications.md「設計方針」）。
 *
 * web（今日タブ・振り返り）と notify（朝/夜/週次通知）が同じ関数を使い、
 * 「通知は来たのに画面に出ていない」という不整合を防ぐ。DB や現在時刻には依存せず、
 * 「今日」は呼び出し側がユーザーのタイムゾーンで求めた日付（`toLocalDate`）を渡す。
 *
 * 日付はすべて `YYYY-MM-DD`。同じ形式なので、前後の比較は文字列比較で行う。
 */

/** 期日計算に必要な Duty の項目。`Duty` をそのまま渡せる */
export type DutyScheduleFields = Pick<Duty, "scheduleConfig" | "createdAt" | "archivedAt">;

export type FixedDueScheduleConfig = Extract<
  ScheduleConfig,
  { type: "DAILY" | "WEEKDAYS" | "NTH_WEEK" | "MONTHLY" }
>;

/**
 * 1つの Duty の期日計算の入力。
 *
 * - `logs`: その Duty のログ。期間で絞り込んでよいが、`SINCE_LAST` は前回 DONE を探すため、
 *   評価する日より前の最新の DONE が含まれている必要がある
 * - `pauses`: その Duty の一時停止期間。`startDate` 〜 `endDate` の前日までが一時停止
 *   （`endDate` は再開した日で、その日からは通常どおり）。`endDate` が null なら一時停止中
 * - `timeZone`: ユーザーのタイムゾーン。`createdAt`・`archivedAt` を日付に変換するのに使う
 * - `weekStart`: ユーザー設定の週の始まり
 *
 * Duty の有効期間は「作成日（`createdAt` の日付）以降」かつ「アーカイブした日（`archivedAt` の日付）より前」
 * かつ「一時停止期間外」。`status` は見ない（一時停止・アーカイブは `pauses`・`archivedAt` から判断する）。
 */
export interface DutyScheduleInput {
  duty: DutyScheduleFields;
  logs: readonly Pick<DutyLog, "targetDate" | "status">[];
  pauses: readonly Pick<DutyPause, "startDate" | "endDate">[];
  timeZone: string;
  weekStart: WeekStart;
}

/**
 * 次の期日を探す日数の上限。月次・隔週なら最長でも数十日で見つかるため、
 * これを超えるのは一時停止中・アーカイブ済みで期日が来ない場合だけ
 */
const NEXT_DUE_SEARCH_DAYS = 400;

type ActivityChecker = (date: string) => boolean;

function createActivityChecker(
  input: Pick<DutyScheduleInput, "duty" | "pauses" | "timeZone">,
): ActivityChecker {
  const createdDate = toLocalDate(input.duty.createdAt, input.timeZone);
  const archivedDate = input.duty.archivedAt
    ? toLocalDate(input.duty.archivedAt, input.timeZone)
    : null;
  return (date) =>
    date >= createdDate &&
    (archivedDate === null || date < archivedDate) &&
    !input.pauses.some(
      (pause) => date >= pause.startDate && (pause.endDate === null || date < pause.endDate),
    );
}

/** DONE のログの対象日。`(dutyId, targetDate)` はユニークだが、念のため重複は1回と数える */
function getDoneDates(logs: DutyScheduleInput["logs"]): Set<string> {
  return new Set(logs.filter((log) => log.status === "DONE").map((log) => log.targetDate));
}

/** `date` より前（`inclusive` なら当日を含む）の最新の DONE の対象日 */
function findLastDone(doneDates: Set<string>, date: string, inclusive: boolean): string | null {
  let last: string | null = null;
  for (const done of doneDates) {
    if ((done < date || (inclusive && done === date)) && (last === null || done > last)) {
      last = done;
    }
  }
  return last;
}

function getLogOn(logs: DutyScheduleInput["logs"], date: string): LogStatus | null {
  return logs.find((log) => log.targetDate === date)?.status ?? null;
}

/** `start` 〜 `end`（両端を含む）の日付 */
function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** `date` が Duty の有効期間内（作成後・アーカイブ前・一時停止期間外）か */
export function isDutyActiveOn(
  input: Pick<DutyScheduleInput, "duty" | "pauses" | "timeZone">,
  date: string,
): boolean {
  return createActivityChecker(input)(date);
}

/**
 * 期日確定型の繰り返しルールが `date` に当たるか（有効期間は見ない）。
 *
 * - `MONTHLY` の日付指定は、その月に該当日がなければ月末に丸める
 * - `MONTHLY` の第N曜日は 1〜4 と最終（-1）
 * - `NTH_WEEK` は `anchor` を含む週を1週目として、そこから偶数週後の週の `weekdays`。
 *   週の区切りは `weekStart`。`anchor` より前の日は当たらない
 */
export function matchesFixedSchedule(
  config: FixedDueScheduleConfig,
  date: string,
  weekStart: WeekStart,
): boolean {
  switch (config.type) {
    case "DAILY":
      return true;
    case "WEEKDAYS":
      return config.weekdays.includes(getWeekday(date));
    case "NTH_WEEK": {
      if (date < config.anchor || !config.weekdays.includes(getWeekday(date))) return false;
      const weeks =
        diffInDays(
          getWeekRange(config.anchor, weekStart).start,
          getWeekRange(date, weekStart).start,
        ) / 7;
      return weeks % config.every === 0;
    }
    case "MONTHLY": {
      const [year, month, day] = date.split("-").map(Number) as [number, number, number];
      const daysInMonth = getDaysInMonth(year, month);
      if ("dayOfMonth" in config) return day === Math.min(config.dayOfMonth, daysInMonth);
      if (getWeekday(date) !== config.weekday) return false;
      // 最終◯曜日は、7日後が翌月になる◯曜日
      return config.nth === -1 ? day + 7 > daysInMonth : Math.ceil(day / 7) === config.nth;
    }
  }
}

function isFixedDueConfig(config: ScheduleConfig): config is FixedDueScheduleConfig {
  return isFixedDueSchedule(config.type);
}

/**
 * 期日確定型の Duty で、`date` が期日か（有効期間内かつルールに当たる）。
 * 取りこぼしは翌日に持ち越さない。期日不確定型は常に false。
 */
export function isDueOn(input: DutyScheduleInput, date: string): boolean {
  const config = input.duty.scheduleConfig;
  return (
    isFixedDueConfig(config) &&
    matchesFixedSchedule(config, date, input.weekStart) &&
    isDutyActiveOn(input, date)
  );
}

export interface SinceLastStatus {
  /**
   * `date` に催促が発生しているか（有効期間内で、`date` より前の最新の DONE から
   * `days` 日以上経っている。DONE が1件もなければ作成日から催促）。
   * `date` 当日のログは見ない（当日に済ませても、その日の催促は発生していたものとして扱う）
   */
  overdue: boolean;
  /** `date` より前の最新の DONE から `date` までの日数（「最後から N 日」）。DONE がなければ null */
  daysSinceLastDone: number | null;
}

/** `SINCE_LAST` の `date` 時点の状態。他のタイプなら null */
export function getSinceLastStatus(input: DutyScheduleInput, date: string): SinceLastStatus | null {
  const config = input.duty.scheduleConfig;
  if (config.type !== "SINCE_LAST") return null;
  // SKIP は起点にしない（「前回完了から N 日」のため）。一時停止中に付いた DONE も起点には使う
  const lastDone = findLastDone(getDoneDates(input.logs), date, false);
  const daysSinceLastDone = lastDone === null ? null : diffInDays(lastDone, date);
  return {
    overdue:
      isDutyActiveOn(input, date) &&
      (daysSinceLastDone === null || daysSinceLastDone >= config.days),
    daysSinceLastDone,
  };
}

export interface WeeklyCountStatus {
  /** `date` を含む週 */
  weekStart: string;
  weekEnd: string;
  /**
   * その週の目標回数（達成率の分母と同じ）。`min(timesPerWeek, 週内の有効日数)`。
   * 作成週は作成日から週末まで、一時停止・アーカイブで欠けた週はその分だけ有効日数が減る
   */
  target: number;
  /** 週初から `date` の前日までの DONE の数（有効日のみ）。`date` 当日のログは含めない */
  doneCount: number;
  /** 週の残回数 `max(0, target - doneCount)` */
  remaining: number;
  /** 残り日数（`date` を含む、`date` から週末まで） */
  remainingDays: number;
  /**
   * 通知に組み込むか。`date` が有効日で、残回数が1以上かつ「残回数 ≥ 残り日数」。
   * 「上回った」時点ではもう週内に達成できないため「以上」とする
   */
  shouldNotify: boolean;
}

/** 週内の有効日数から決まる、`WEEKLY_COUNT` のその週の目標回数 */
function getWeeklyTarget(timesPerWeek: number, weekDates: string[], isActive: ActivityChecker) {
  return Math.min(timesPerWeek, weekDates.filter(isActive).length);
}

/** `start` 〜 `end`（両端を含む）の有効日に付いた DONE の数 */
function countDoneBetween(
  doneDates: Set<string>,
  start: string,
  end: string,
  isActive: ActivityChecker,
): number {
  let count = 0;
  for (const date of doneDates) {
    if (date >= start && date <= end && isActive(date)) count++;
  }
  return count;
}

/** `WEEKLY_COUNT` の `date` 時点の状態。他のタイプなら null */
export function getWeeklyCountStatus(
  input: DutyScheduleInput,
  date: string,
): WeeklyCountStatus | null {
  const config = input.duty.scheduleConfig;
  if (config.type !== "WEEKLY_COUNT") return null;
  const isActive = createActivityChecker(input);
  const week = getWeekRange(date, input.weekStart);
  const target = getWeeklyTarget(config.timesPerWeek, eachDate(week.start, week.end), isActive);
  const doneCount = countDoneBetween(
    getDoneDates(input.logs),
    week.start,
    addDays(date, -1),
    isActive,
  );
  const remaining = Math.max(0, target - doneCount);
  const remainingDays = diffInDays(date, week.end) + 1;
  return {
    weekStart: week.start,
    weekEnd: week.end,
    target,
    doneCount,
    remaining,
    remainingDays,
    shouldNotify: isActive(date) && remaining >= 1 && remaining >= remainingDays,
  };
}

/**
 * 今日タブのセクション。docs/04-screens.md「4-1. 今日」
 * - `TODAY`: 今日（期日確定型で期日）
 * - `SOON`: そろそろ（`SINCE_LAST` で催促が発生）
 * - `THIS_WEEK`: 今週（`WEEKLY_COUNT` で残回数がある）
 */
export type TodaySection = "TODAY" | "SOON" | "THIS_WEEK";

/**
 * Duty の `date` の評価。`section` は当日のログより前の状態で決まるため、
 * その日に済ませても `section` は変わらず、`log` が `"DONE"` になる（今日タブでは「済んだもの」に入る）。
 */
export type DutyDayEvaluation =
  | { section: null; log: LogStatus | null }
  | { section: "TODAY"; log: LogStatus | null }
  | ({ section: "SOON"; log: LogStatus | null } & SinceLastStatus)
  | ({ section: "THIS_WEEK"; log: LogStatus | null } & WeeklyCountStatus);

/** Duty が `date` に今日タブのどのセクションに出るかと、その日のログ */
export function evaluateDutyOn(input: DutyScheduleInput, date: string): DutyDayEvaluation {
  const log = getLogOn(input.logs, date);
  const config = input.duty.scheduleConfig;
  if (config.type === "SINCE_LAST") {
    const status = getSinceLastStatus(input, date)!;
    return status.overdue ? { section: "SOON", log, ...status } : { section: null, log };
  }
  if (config.type === "WEEKLY_COUNT") {
    const status = getWeeklyCountStatus(input, date)!;
    return isDutyActiveOn(input, date) && status.remaining >= 1
      ? { section: "THIS_WEEK", log, ...status }
      : { section: null, log };
  }
  return isDueOn(input, date) ? { section: "TODAY", log } : { section: null, log };
}

/**
 * 朝の日次まとめ・締め切りアラートに含めるか。
 * `TODAY`・`SOON` と、`THIS_WEEK` のうち `shouldNotify` のもの。済・スキップしたものは除く
 */
export function isNotificationTarget(evaluation: DutyDayEvaluation): boolean {
  if (evaluation.log !== null) return false;
  switch (evaluation.section) {
    case "TODAY":
    case "SOON":
      return true;
    case "THIS_WEEK":
      return evaluation.shouldNotify;
    case null:
      return false;
  }
}

export interface Achievement {
  /** 分子（済んだ数） */
  done: number;
  /** 分母 */
  total: number;
}

/**
 * `weekDate` を含む週の達成率の分母・分子（docs/03「達成率の分母」）。
 * `asOf`（今日）より後の日は数えない。ただし `WEEKLY_COUNT` の分母は週全体の目標回数。
 *
 * - 期日確定型: 分母は週内に到来した期日数、分子はそのうち DONE の数
 * - `WEEKLY_COUNT`: 分母は `WeeklyCountStatus.target`、分子は週内の DONE の数（分母で頭打ち）
 * - `SINCE_LAST`: 分子は週内の DONE の数、分母はそれに週末（今週なら `asOf`）時点で催促が続いていれば +1
 *
 * 一時停止期間・アーカイブした日以降・作成日より前は分母にも分子にも含めない。
 * 週がまるごと `asOf` より後なら `{ done: 0, total: 0 }`。
 */
export function getWeeklyAchievement(
  input: DutyScheduleInput,
  weekDate: string,
  asOf: string,
): Achievement {
  const week = getWeekRange(weekDate, input.weekStart);
  if (asOf < week.start) return { done: 0, total: 0 };
  const last = asOf < week.end ? asOf : week.end;
  const isActive = createActivityChecker(input);
  const doneDates = getDoneDates(input.logs);
  const config = input.duty.scheduleConfig;

  switch (config.type) {
    case "WEEKLY_COUNT": {
      const total = getWeeklyTarget(config.timesPerWeek, eachDate(week.start, week.end), isActive);
      const done = countDoneBetween(doneDates, week.start, last, isActive);
      return { done: Math.min(done, total), total };
    }
    case "SINCE_LAST": {
      const done = countDoneBetween(doneDates, week.start, last, isActive);
      // 催促の回数はログから導出する: 週内の完了数 + 週末時点で催促が続いていれば 1
      const stillOverdue = getSinceLastStatus(input, last)!.overdue && !doneDates.has(last);
      return { done, total: done + (stillOverdue ? 1 : 0) };
    }
    default: {
      const dueDates = eachDate(week.start, last).filter(
        (date) => matchesFixedSchedule(config, date, input.weekStart) && isActive(date),
      );
      return {
        done: dueDates.filter((date) => doneDates.has(date)).length,
        total: dueDates.length,
      };
    }
  }
}

/**
 * 次の期日のプレビュー（docs/03「共通仕様」の「次の期日: 8/26（水）」「あと1回・日曜まで」）。
 * 文言の組み立ては UI 側で行う。
 * - `DATE`: 期日確定型は `from` 以降で最初の期日。`SINCE_LAST` は催促が始まる日
 *   （`from` 以前の最新の DONE + `days` 日。DONE がなければ作成日。いずれも `from` より前なら `from`）
 * - `WEEKLY_COUNT`: `from` を含む週の残回数（`from` 当日の DONE も差し引く）と週の最終日
 */
export type NextDue =
  { type: "DATE"; date: string } | { type: "WEEKLY_COUNT"; remaining: number; weekEnd: string };

/** `start` 以降で最初に `predicate` を満たす日。探索の上限を超えたら null */
function findDateFrom(start: string, predicate: (date: string) => boolean): string | null {
  for (let i = 0; i < NEXT_DUE_SEARCH_DAYS; i++) {
    const date = addDays(start, i);
    if (predicate(date)) return date;
  }
  return null;
}

/**
 * `from` 以降の次の期日。一時停止中・アーカイブ済みなどで期日が来ない場合は null。
 * 作成前のプレビューには、`createdAt` を現在時刻、`logs`・`pauses` を空にした入力を渡す。
 */
export function getNextDue(input: DutyScheduleInput, from: string): NextDue | null {
  const isActive = createActivityChecker(input);
  const config = input.duty.scheduleConfig;

  switch (config.type) {
    case "WEEKLY_COUNT": {
      if (!isActive(from)) return null;
      const status = getWeeklyCountStatus(input, from)!;
      const doneToday = getDoneDates(input.logs).has(from) ? 1 : 0;
      return {
        type: "WEEKLY_COUNT",
        remaining: Math.max(0, status.target - status.doneCount - doneToday),
        weekEnd: status.weekEnd,
      };
    }
    case "SINCE_LAST": {
      const lastDone = findLastDone(getDoneDates(input.logs), from, true);
      const candidate =
        lastDone === null
          ? toLocalDate(input.duty.createdAt, input.timeZone)
          : addDays(lastDone, config.days);
      const date = findDateFrom(candidate < from ? from : candidate, isActive);
      return date === null ? null : { type: "DATE", date };
    }
    default: {
      // 隔週はアンカーより前に期日がないため、アンカーから探す
      const start = config.type === "NTH_WEEK" && config.anchor > from ? config.anchor : from;
      const date = findDateFrom(
        start,
        (d) => matchesFixedSchedule(config, d, input.weekStart) && isActive(d),
      );
      return date === null ? null : { type: "DATE", date };
    }
  }
}
