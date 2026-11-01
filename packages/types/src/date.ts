import type { WeekStart } from "./duty";

/**
 * 期日計算で使う日付ユーティリティ。日付はすべて `YYYY-MM-DD` の文字列で扱い、
 * 実行環境のタイムゾーン（`Date` のローカル時刻）には依存しない。
 * 日時（`Date`）から日付への変換だけがタイムゾーンを受け取る。
 */

const MS_PER_DAY = 86_400_000;

/** 1970-01-01 からの日数。内部の日付計算はこの整数で行う */
function toDayNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);
}

// Intl.DateTimeFormat の生成は重いため、タイムゾーンごとに使い回す
const formatters = new Map<string, Intl.DateTimeFormat>();

/** 日時を、指定したタイムゾーン（IANA 名）での日付 `YYYY-MM-DD` に変換する。1日の区切りは0時 */
export function toLocalDate(instant: Date, timeZone: string): string {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}

/** `date` の `days` 日後（負なら前）の日付 */
export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days);
}

/** `from` から `to` までの日数（`to - from`）。同じ日なら 0、`to` が前なら負 */
export function diffInDays(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** 曜日。`Date#getDay()` と同じく 0=日 〜 6=土 */
export function getWeekday(date: string): number {
  // 1970-01-01 は木曜（4）
  return (((toDayNumber(date) + 4) % 7) + 7) % 7;
}

/** その月の日数。`month` は 1〜12 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface WeekRange {
  /** 週の初日（週の始まりの曜日） */
  start: string;
  /** 週の最終日（週の始まりが月曜なら日曜） */
  end: string;
}

/** `date` を含む週の範囲。週の区切りはユーザー設定の「週の始まり」に従う */
export function getWeekRange(date: string, weekStart: WeekStart): WeekRange {
  const offset = (getWeekday(date) - weekStart + 7) % 7;
  const start = addDays(date, -offset);
  return { start, end: addDays(start, 6) };
}
