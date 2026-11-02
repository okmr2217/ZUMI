import { getWeekday } from "@zumi/types";
import type { NotificationItem, WeeklySummary } from "./digest";
import type { NotificationKind } from "./schedule";

/**
 * 通知の文面（docs/02-notifications.md「通知の文面」）。
 *
 * - Web Push は展開前だとタイトル＋1〜2行しか見えないため、件数と Duty 名を先頭に置く
 * - 「催促」はバックエンド用語なので使わず「そろそろ」と言う。絵文字は使わない
 */

/**
 * Service Worker に渡すペイロード。S7（Service Worker）と合わせるまでの仮の形式。
 * - `url`: タップ時に開くパス
 * - `tag`: 同じ種類の通知を置き換えるためのタグ（重複送信や前日の通知が並ばないように）
 */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

const TODAY_URL = "/app";
/** 振り返りタブ。ルートは S9 で確定する（仮） */
const REVIEW_URL = "/app/review";

const TAGS: Record<NotificationKind, string> = {
  MORNING: "zumi-morning",
  EVENING: "zumi-evening",
  WEEKLY: "zumi-weekly",
};

/**
 * 本文の目安の長さ。展開前の通知で1〜2行に収まる程度。
 * これを超える分は「ほか N件」にまとめる（最初の1件は長くても載せる）
 */
export const BODY_MAX_LENGTH = 40;

const WEEKDAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 本文に載せる1件分。「そろそろ」「あと1回・日曜まで」を Duty 名の後ろに付ける */
export function formatItem(item: NotificationItem, today: string): string {
  switch (item.section) {
    case "TODAY":
      return item.name;
    case "SOON":
      return `${item.name}（そろそろ）`;
    case "THIS_WEEK": {
      const until =
        item.weekEnd === today ? "今日" : `${WEEKDAY_NAMES[getWeekday(item.weekEnd)]}曜`;
      return `${item.name}（あと${item.remaining}回・${until}まで）`;
    }
  }
}

/** Duty 名を「・」でつなぐ。`BODY_MAX_LENGTH` を超える分は「ほか N件」で省略する */
export function formatItemList(items: readonly NotificationItem[], today: string): string {
  const labels = items.map((item) => formatItem(item, today));
  for (let shown = labels.length; shown >= 1; shown--) {
    const rest = labels.length - shown;
    const text = labels.slice(0, shown).join("・") + (rest > 0 ? ` ほか ${rest}件` : "");
    if (text.length <= BODY_MAX_LENGTH || shown === 1) return text;
  }
  return "";
}

/** 朝の日次まとめ。対象がゼロなら送らない（null） */
export function buildMorningMessage(
  items: readonly NotificationItem[],
  today: string,
): PushMessage | null {
  if (items.length === 0) return null;
  return {
    title: `今日の Duty ${items.length}件`,
    body: formatItemList(items, today),
    url: TODAY_URL,
    tag: TAGS.MORNING,
  };
}

/** 締め切りアラート。未完了の対象がゼロなら送らない（null） */
export function buildEveningMessage(
  items: readonly NotificationItem[],
  today: string,
): PushMessage | null {
  if (items.length === 0) return null;
  return {
    title: `まだ済んでいないもの ${items.length}件`,
    body: formatItemList(items, today),
    url: TODAY_URL,
    tag: TAGS.EVENING,
  };
}

/**
 * 週次サマリー。「先週より +3」は済んだ数（分子）の差。
 * 今週の分母がゼロ（対象の Duty がない）なら送らない。先週の分母がゼロなら前週比は出さない。
 */
export function buildWeeklyMessage(summary: WeeklySummary): PushMessage | null {
  const { thisWeek, lastWeek } = summary;
  if (thisWeek.total === 0) return null;
  const diff = thisWeek.done - lastWeek.done;
  const comparison =
    lastWeek.total === 0
      ? ""
      : diff === 0
        ? "先週と同じ。"
        : `先週より ${diff > 0 ? "+" : "-"}${Math.abs(diff)}。`;
  return {
    title: `今週は ${thisWeek.done}/${thisWeek.total}`,
    body: `${comparison}シェア用のカードができています`,
    url: REVIEW_URL,
    tag: TAGS.WEEKLY,
  };
}
