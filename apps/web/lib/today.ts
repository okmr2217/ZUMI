import {
  evaluateDutyOn,
  getWeekday,
  toLocalDate,
  type LogStatus,
  type TodaySection,
  type WeekStart,
} from "@zumi/types";
import type { DayDuty } from "./logs";
import { summarizeSchedule, WEEKDAY_LABELS } from "./schedule-text";

/**
 * 今日タブの表示用データ（docs/04-screens.md「4-1. 今日」）。
 * セクションの判定は `@zumi/types` の `evaluateDutyOn` だけで行い、画面側で独自の期日判定は書かない
 * （通知（apps/notify）と結果を一致させるため）。
 */

/** 開いている日が今日・過去・未来のどれか。未来日は確認のみで記録できない */
export type DayMode = "today" | "past" | "future";

export function getDayMode(date: string, today: string): DayMode {
  return date === today ? "today" : date < today ? "past" : "future";
}

export interface TodayLog {
  status: LogStatus;
  note: string | null;
}

export interface TodayItem {
  id: string;
  name: string;
  icon: string;
  noteEnabled: boolean;
  /** 作成日（ユーザーのタイムゾーン）。詳細モーダルの対象日の下限 */
  createdDate: string;
  section: TodaySection;
  /** 名前の下の補足（「火・金」「最後から2日」「あと1回・日曜まで」） */
  detail: string;
  /** その日のログ */
  log: TodayLog | null;
}

const SECTION_ORDER: Record<TodaySection, number> = { TODAY: 0, SOON: 1, THIS_WEEK: 2 };

/**
 * `date` に出る Duty。並びは「今日」「そろそろ」「今週」の順、セクション内は `sortOrder` 順。
 * セクションは当日のログより前の状態で決まるため、当日に済ませても同じセクションのまま `log` だけが変わる。
 */
export function buildTodayItems(
  dayDuties: readonly DayDuty[],
  date: string,
  weekStart: WeekStart,
): TodayItem[] {
  const items: TodayItem[] = [];
  for (const { duty, schedule, log } of dayDuties) {
    const evaluation = evaluateDutyOn(schedule, date);
    if (evaluation.section === null) continue;
    let detail: string;
    switch (evaluation.section) {
      case "TODAY":
        detail = summarizeSchedule(duty.scheduleConfig, weekStart);
        break;
      case "SOON":
        detail =
          evaluation.daysSinceLastDone === null
            ? "前回の記録なし"
            : `最後から${evaluation.daysSinceLastDone}日`;
        break;
      case "THIS_WEEK":
        detail = `あと${evaluation.remaining}回・${WEEKDAY_LABELS[getWeekday(evaluation.weekEnd)]}曜まで`;
        break;
    }
    items.push({
      id: duty.id,
      name: duty.name,
      icon: duty.icon,
      noteEnabled: duty.noteEnabled,
      createdDate: toLocalDate(duty.createdAt, schedule.timeZone),
      section: evaluation.section,
      detail,
      log,
    });
  }
  // Array#sort は安定なので、セクション内は渡された順（sortOrder 順）のまま
  return items.sort((a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section]);
}

/** 日付ナビの日付（例: 「11月2日（月）」） */
export function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${m}月${d}日（${WEEKDAY_LABELS[getWeekday(date)]}）`;
}
