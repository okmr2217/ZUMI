import { redirect } from "next/navigation";
import { addDays, getWeekRange, toLocalDate } from "@zumi/types";
import { getServerSession } from "./auth";
import { getDb } from "./db";
import { getUserCalendar } from "./duties";
import { isLocalDate } from "./log-input";
import { getHistoryStartDate, listHistoryDuties, loadHistory, loadWeeklySummary } from "./review";

const REVIEW_PATH = "/app/review";

/**
 * 振り返りタブのデータ。`requestedWeek`（`?week=YYYY-MM-DD`、週の初日）で過去の週のサマリーも開ける。
 * 開ける週は、無料プランの履歴の範囲（直近3ヶ月）に掛かる週から今週まで。
 * 範囲外・不正な日付・今週は `/app/review` に、週の途中の日は週の初日にそろえる。
 */
export async function getReviewPageData(requestedWeek: string | undefined) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const db = getDb();
  const calendar = await getUserCalendar(db, userId);
  const today = toLocalDate(new Date(), calendar.timeZone);
  const currentWeek = getWeekRange(today, calendar.weekStart).start;
  const oldestWeek = getWeekRange(getHistoryStartDate(today), calendar.weekStart).start;

  let week = currentWeek;
  if (requestedWeek !== undefined) {
    if (!isLocalDate(requestedWeek)) redirect(REVIEW_PATH);
    week = getWeekRange(requestedWeek, calendar.weekStart).start;
    if (week >= currentWeek || week < oldestWeek) redirect(REVIEW_PATH);
    if (week !== requestedWeek) redirect(weekHref(week, currentWeek));
  }

  const [summary, history, dutyOptions] = await Promise.all([
    loadWeeklySummary(db, userId, week, today, calendar),
    loadHistory(db, userId, { today }, calendar.timeZone),
    listHistoryDuties(db, userId, today),
  ]);

  const previous = addDays(week, -7);
  const next = addDays(week, 7);
  return {
    summary,
    previousWeekHref: previous >= oldestWeek ? weekHref(previous, currentWeek) : null,
    nextWeekHref: next <= currentWeek ? weekHref(next, currentWeek) : null,
    history,
    dutyOptions,
  };
}

const weekHref = (week: string, currentWeek: string) =>
  week === currentWeek ? REVIEW_PATH : `${REVIEW_PATH}?week=${week}`;
