import { redirect } from "next/navigation";
import { addDays, getWeekRange, toLocalDate } from "@zumi/types";
import { getServerSession } from "./auth";
import { getDb } from "./db";
import { getUserCalendar } from "./duties";
import { isLocalDate } from "./log-input";
import {
  addMonths,
  getHeatmapMonthRange,
  getReviewWeekRange,
  isMonth,
  listHistoryDuties,
  loadHistory,
  loadMonthHeatmap,
  loadWeeklySummary,
} from "./review";

const REVIEW_PATH = "/app/review";

/** 振り返りタブの3つの表示（モックの切り替えボタン）。URL では `?view=` で指す */
export type ReviewView = "summary" | "heatmap" | "history";

export function reviewHref(
  view: ReviewView,
  params: { week?: string; month?: string; duty?: string } = {},
): string {
  const query = new URLSearchParams();
  if (view !== "summary") query.set("view", view);
  if (params.week) query.set("week", params.week);
  if (params.month) query.set("month", params.month);
  if (params.duty) query.set("duty", params.duty);
  const text = query.toString();
  return text ? `${REVIEW_PATH}?${text}` : REVIEW_PATH;
}

type Param = string | string[] | undefined;

function parseView(value: Param): ReviewView {
  return value === "heatmap" || value === "history" ? value : "summary";
}

/**
 * 振り返りタブのデータ。表示（`?view=`）に必要な分だけ読む。
 * - 週次サマリー: `?week=YYYY-MM-DD`（週の初日）で過去の週も開ける。開ける週は `getReviewWeekRange` の範囲。
 *   範囲外・不正な日付・今週は `/app/review` に、週の途中の日は週の初日にそろえる
 * - ヒートマップ: `?month=YYYY-MM`、`?duty=<Duty ID>`（省略は全体）。月は `getHeatmapMonthRange` の範囲
 * - 履歴: 最初の1ページ。続きはクライアントが API で読む
 */
export async function getReviewPageData(searchParams: Record<string, Param>) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const view = parseView(searchParams.view);
  const str = (value: Param) => (typeof value === "string" ? value : undefined);

  const db = getDb();
  const calendar = await getUserCalendar(db, userId);
  const today = toLocalDate(new Date(), calendar.timeZone);

  if (view === "heatmap") {
    const { oldest, current } = getHeatmapMonthRange(today);
    const requestedMonth = str(searchParams.month);
    let month = current;
    if (requestedMonth !== undefined) {
      if (!isMonth(requestedMonth) || requestedMonth >= current || requestedMonth < oldest) {
        redirect(reviewHref("heatmap", { duty: str(searchParams.duty) }));
      }
      month = requestedMonth;
    }
    const dutyOptions = await listHistoryDuties(db, userId, today);
    // 知らない Duty の指定は全体として扱う
    const requestedDuty = str(searchParams.duty);
    const dutyId = dutyOptions.find((option) => option.id === requestedDuty)?.id;
    const heatmap = await loadMonthHeatmap(db, userId, month, today, calendar, dutyId);
    const monthHref = (target: string) =>
      reviewHref("heatmap", { month: target === current ? undefined : target, duty: dutyId });
    const previous = addMonths(month, -1);
    const next = addMonths(month, 1);
    return {
      view,
      today,
      weekStart: calendar.weekStart,
      heatmap,
      dutyOptions,
      dutyId: dutyId ?? null,
      previousMonthHref: previous >= oldest ? monthHref(previous) : null,
      nextMonthHref: next <= current ? monthHref(next) : null,
    } as const;
  }

  if (view === "history") {
    const [history, dutyOptions] = await Promise.all([
      loadHistory(db, userId, { today }, calendar.timeZone),
      listHistoryDuties(db, userId, today),
    ]);
    return { view, history, dutyOptions } as const;
  }

  const requestedWeek = str(searchParams.week);
  const { oldest: oldestWeek, current: currentWeek } = getReviewWeekRange(
    today,
    calendar.weekStart,
  );
  const weekHref = (week: string) =>
    reviewHref("summary", { week: week === currentWeek ? undefined : week });

  let week = currentWeek;
  if (requestedWeek !== undefined) {
    if (!isLocalDate(requestedWeek)) redirect(REVIEW_PATH);
    week = getWeekRange(requestedWeek, calendar.weekStart).start;
    if (week >= currentWeek || week < oldestWeek) redirect(REVIEW_PATH);
    if (week !== requestedWeek) redirect(weekHref(week));
  }

  const summary = await loadWeeklySummary(db, userId, week, today, calendar);
  const previous = addDays(week, -7);
  const next = addDays(week, 7);
  return {
    view,
    summary,
    previousWeekHref: previous >= oldestWeek ? weekHref(previous) : null,
    nextWeekHref: next <= currentWeek ? weekHref(next) : null,
  } as const;
}
