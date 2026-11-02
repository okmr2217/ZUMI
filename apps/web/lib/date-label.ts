/**
 * 画面に出す日付の文言。クライアントコンポーネントからも読むため、`@zumi/types`（期日計算ロジックを含む）や
 * サーバー専用のモジュールには依存させない。
 */

export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** `YYYY-MM-DD` の曜日（0=日 〜 6=土）。実行環境のタイムゾーンには依存しない */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 日付ナビ・履歴の日付（例: 「11月2日（月）」） */
export function formatDayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${m}月${d}日（${WEEKDAY_LABELS[weekdayOf(date)]}）`;
}

/** 週の期間（「2026.08.17 — 08.23」）。年をまたぐ週は終わりにも年を付ける */
export function formatPeriod(start: string, end: string): string {
  const dotted = (date: string) => date.replaceAll("-", ".");
  return `${dotted(start)} — ${start.slice(0, 4) === end.slice(0, 4) ? dotted(end.slice(5)) : dotted(end)}`;
}
