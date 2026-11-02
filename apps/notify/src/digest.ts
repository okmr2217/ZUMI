import {
  addDays,
  evaluateDutyOn,
  getWeeklyAchievement,
  isNotificationTarget,
  type Achievement,
  type DutyScheduleInput,
  type TodaySection,
} from "@zumi/types";

/**
 * 通知に載せる内容の集計。期日の判定は packages/types の共有関数だけを使い、
 * notify 側では独自の判定を書かない（今日タブとのズレを防ぐため）。
 */

/** 通知の集計に使う Duty。`schedule` は期日計算の入力そのまま */
export interface NotifyDuty {
  name: string;
  sortOrder: number;
  schedule: DutyScheduleInput;
}

export type NotificationItem =
  | { name: string; section: "TODAY" | "SOON" }
  | { name: string; section: "THIS_WEEK"; remaining: number; weekEnd: string };

const SECTION_ORDER: Record<TodaySection, number> = { TODAY: 0, SOON: 1, THIS_WEEK: 2 };

/**
 * 朝の日次まとめ・締め切りアラートに載せる Duty（`isNotificationTarget` が true のもの）。
 * 並びは「今日」「そろそろ」「今週」の順、セクション内は `sortOrder` 順（docs/02「通知の文面」）。
 * 済・スキップしたものは `isNotificationTarget` で除かれる（朝も夜も同じ）。
 */
export function collectNotificationItems(
  duties: readonly NotifyDuty[],
  today: string,
): NotificationItem[] {
  const items: (NotificationItem & { sortOrder: number })[] = [];
  for (const duty of duties) {
    const evaluation = evaluateDutyOn(duty.schedule, today);
    if (!isNotificationTarget(evaluation)) continue;
    switch (evaluation.section) {
      case "TODAY":
      case "SOON":
        items.push({ name: duty.name, section: evaluation.section, sortOrder: duty.sortOrder });
        break;
      case "THIS_WEEK":
        items.push({
          name: duty.name,
          section: "THIS_WEEK",
          remaining: evaluation.remaining,
          weekEnd: evaluation.weekEnd,
          sortOrder: duty.sortOrder,
        });
        break;
    }
  }
  // Array#sort は安定なので、同じ sortOrder なら渡された順のまま
  items.sort(
    (a, b) => SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.sortOrder - b.sortOrder,
  );
  return items.map(({ sortOrder: _, ...item }) => item);
}

export interface WeeklySummary {
  thisWeek: Achievement;
  lastWeek: Achievement;
}

/**
 * 週次サマリーの達成率。`today`（週の最終日）を含む週と、その前の週について、
 * Duty ごとの `getWeeklyAchievement` を合計する（振り返りタブと同じ集計）。
 * `logs` には前の週の分と、`SINCE_LAST` では前の週より前の最新の DONE も含めること。
 */
export function summarizeWeek(duties: readonly NotifyDuty[], today: string): WeeklySummary {
  const sum = (weekDate: string): Achievement =>
    duties.reduce(
      (acc, duty) => {
        const achievement = getWeeklyAchievement(duty.schedule, weekDate, today);
        return { done: acc.done + achievement.done, total: acc.total + achievement.total };
      },
      { done: 0, total: 0 },
    );
  return { thisWeek: sum(today), lastWeek: sum(addDays(today, -7)) };
}
