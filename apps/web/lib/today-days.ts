import type { Db, UserCalendar } from "./duties";
import { loadDayDuties } from "./logs";
import { buildTodayItems, getDayMode, type DayData } from "./today";

/** 1回で取れる日数の上限。表示日の前後 3 日ぶん + 余裕 */
export const MAX_DAYS_PER_REQUEST = 9;

/** `dates` の各日の今日タブのデータ。日ごとに独立しているので並列に読む */
export function loadDays(
  db: Db,
  userId: string,
  dates: readonly string[],
  today: string,
  calendar: UserCalendar,
): Promise<DayData[]> {
  return Promise.all(
    dates.map(async (date) => {
      const dayDuties = await loadDayDuties(db, userId, date, calendar);
      return {
        date,
        mode: getDayMode(date, today),
        items: buildTodayItems(dayDuties, date, calendar.weekStart),
        hasDuties: dayDuties.length > 0,
      };
    }),
  );
}
