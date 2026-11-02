import { getWeekRange, toLocalDate, type WeekStart } from "@zumi/types";

/**
 * Cron の1回（1分）で、どのユーザーにどの通知を送るかの判定。D1 には依存しない。
 *
 * 抽出は2段階で行う（docs/05-tech-stack.md「通知配信の設計」）。
 * 1. `getCandidateLocalTimes` で、いま世界のどこかで現地時刻になっている HH:MM の集合
 *    （UTC オフセットの種類ぶん、40前後）を求め、`*_notify_at` がそのどれかに一致する
 *    設定だけを D1 から読む。全ユーザーを毎分読まずに済む
 * 2. 読んだ設定ごとに、そのユーザーのタイムゾーンでの現在時刻と突き合わせる（`getDueNotifications`）
 */

export type NotificationKind = "MORNING" | "EVENING" | "WEEKLY";

/** 通知の判定に使う `user_settings` の項目 */
export interface NotifySettings {
  userId: string;
  timezone: string;
  morningNotifyEnabled: boolean;
  morningNotifyAt: string | null;
  eveningNotifyEnabled: boolean;
  eveningNotifyAt: string | null;
  weeklySummaryEnabled: boolean;
  weeklySummaryAt: string;
  weekStart: WeekStart;
}

// Intl.DateTimeFormat の生成は重いため、タイムゾーンごとに使い回す
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/** 日時を、指定したタイムゾーン（IANA 名）での時刻 `HH:MM`（00:00〜23:59）に変換する */
export function toLocalTime(instant: Date, timeZone: string): string {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    timeFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${part("hour")}:${part("minute")}`;
}

/**
 * 実在する UTC オフセットはすべて15分の倍数で、-12:00〜+14:00 に収まる。
 * `Intl.supportedValuesOf` が使えない環境では、この範囲を候補にする
 */
const MIN_OFFSET_MINUTES = -12 * 60;
const MAX_OFFSET_MINUTES = 14 * 60;
const OFFSET_STEP_MINUTES = 15;

function formatUtcTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16);
}

/**
 * `instant` の時点で、いずれかのタイムゾーンの現地時刻になっている `HH:MM` の集合（昇順）。
 * D1 の絞り込み用で、最終的な一致判定は `getDueNotifications` で行う。
 */
export function getCandidateLocalTimes(
  instant: Date,
  timeZones: readonly string[] | null = getSupportedTimeZones(),
): string[] {
  const times = new Set<string>();
  if (timeZones) {
    for (const timeZone of timeZones) times.add(toLocalTime(instant, timeZone));
  } else {
    for (let m = MIN_OFFSET_MINUTES; m <= MAX_OFFSET_MINUTES; m += OFFSET_STEP_MINUTES) {
      times.add(formatUtcTime(instant.getTime() + m * 60_000));
    }
  }
  return [...times].sort();
}

function getSupportedTimeZones(): string[] | null {
  // "UTC" は supportedValuesOf に含まれない実装があるため足しておく
  return typeof Intl.supportedValuesOf === "function"
    ? [...Intl.supportedValuesOf("timeZone"), "UTC"]
    : null;
}

export interface DueNotifications {
  /** ユーザーのタイムゾーンでの今日 */
  today: string;
  kinds: NotificationKind[];
}

/**
 * `instant`（Cron の予定時刻を分に切り捨てたもの）に送る通知。
 * 週次サマリーは、ユーザーの「週の始まり」から求めた週の最終日だけ送る（docs/02「設計方針」）。
 * タイムゾーンが不正なら RangeError を投げる（呼び出し側がユーザー単位で捕まえる）。
 */
export function getDueNotifications(settings: NotifySettings, instant: Date): DueNotifications {
  const today = toLocalDate(instant, settings.timezone);
  const now = toLocalTime(instant, settings.timezone);
  const kinds: NotificationKind[] = [];
  if (settings.morningNotifyEnabled && settings.morningNotifyAt === now) kinds.push("MORNING");
  if (settings.eveningNotifyEnabled && settings.eveningNotifyAt === now) kinds.push("EVENING");
  if (
    settings.weeklySummaryEnabled &&
    settings.weeklySummaryAt === now &&
    getWeekRange(today, settings.weekStart).end === today
  ) {
    kinds.push("WEEKLY");
  }
  return { today, kinds };
}
