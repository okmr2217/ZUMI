import {
  addDays,
  getWeekday,
  type NextDue,
  type ScheduleConfig,
  type WeekStart,
} from "@zumi/types";
import { WEEKDAY_LABELS } from "./date-label";

/**
 * 繰り返し設定・次の期日の文言（docs/03「繰り返しタイプの選択UI」の「共通仕様」）。
 * 設定結果を都度言語化して、ユーザーが自分で設定ミスに気づけるようにする。
 */

export { WEEKDAY_LABELS };

/** 週の始まりから並べた曜日（0=日 〜 6=土） */
export function orderedWeekdays(weekStart: WeekStart): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
}

function formatWeekdays(weekdays: readonly number[], weekStart: WeekStart): string {
  return orderedWeekdays(weekStart)
    .filter((day) => weekdays.includes(day))
    .map((day) => WEEKDAY_LABELS[day])
    .join("・");
}

export function formatNth(nth: -1 | 1 | 2 | 3 | 4): string {
  return nth === -1 ? "最終" : `第${nth}`;
}

/** 一覧カード・テンプレートカードに出す繰り返しの要約（例: 「火・金」「前回から2日空いたら」） */
export function summarizeSchedule(config: ScheduleConfig, weekStart: WeekStart): string {
  switch (config.type) {
    case "DAILY":
      return "毎日";
    case "WEEKDAYS":
      return config.weekdays.length === 0
        ? "曜日が決まっている"
        : formatWeekdays(config.weekdays, weekStart);
    case "NTH_WEEK":
      return `隔週 ${formatWeekdays(config.weekdays, weekStart)}`;
    case "MONTHLY":
      return "dayOfMonth" in config
        ? `毎月${config.dayOfMonth}日`
        : `毎月${formatNth(config.nth)}${WEEKDAY_LABELS[config.weekday]}曜`;
    case "WEEKLY_COUNT":
      return `週に${config.timesPerWeek}回`;
    case "SINCE_LAST":
      return `前回から${config.days}日空いたら`;
  }
}

/** `M/D（曜）` */
export function formatShortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${m}/${d}（${WEEKDAY_LABELS[getWeekday(date)]}）`;
}

/** 次の期日のプレビュー文言。`null`（一時停止中など、期日が来ない）なら null */
export function formatNextDue(nextDue: NextDue | null, today: string): string | null {
  if (!nextDue) return null;
  if (nextDue.type === "WEEKLY_COUNT") {
    if (nextDue.remaining === 0) return "今週の分は済んでいます";
    return `今週あと${nextDue.remaining}回・${WEEKDAY_LABELS[getWeekday(nextDue.weekEnd)]}曜まで`;
  }
  const prefix =
    nextDue.date === today ? "今日 " : nextDue.date === addDays(today, 1) ? "明日 " : "";
  return `次の期日：${prefix}${formatShortDate(nextDue.date)}`;
}
