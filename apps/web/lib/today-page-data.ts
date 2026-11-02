import { redirect } from "next/navigation";
import { toLocalDate } from "@zumi/types";
import { getServerSession } from "./auth";
import { getDb } from "./db";
import { getUserCalendar } from "./duties";
import { isLocalDate } from "./log-input";
import { loadDayDuties } from "./logs";
import { buildTodayItems, getDayMode } from "./today";

/**
 * 今日タブのデータ。`requestedDate`（`?date=YYYY-MM-DD`）で過去日・未来日も開ける。
 * 「今日」はユーザーのタイムゾーン（`user_settings.timezone`）で求める。
 * 不正な日付と今日の日付は `/app` にそろえる（今日の URL を1つにする）。
 */
export async function getTodayPageData(requestedDate: string | undefined) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const db = getDb();
  const calendar = await getUserCalendar(db, userId);
  const today = toLocalDate(new Date(), calendar.timeZone);
  if (requestedDate !== undefined && (!isLocalDate(requestedDate) || requestedDate === today)) {
    redirect("/app");
  }
  const date = requestedDate ?? today;
  const dayDuties = await loadDayDuties(db, userId, date, calendar);

  return {
    today,
    date,
    mode: getDayMode(date, today),
    items: buildTodayItems(dayDuties, date, calendar.weekStart),
    hasDuties: dayDuties.length > 0,
  };
}
