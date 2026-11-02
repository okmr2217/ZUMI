import type { PresetIconName } from "./icons";
import type { ScheduleConfig } from "./schedule";

/**
 * Duty のテンプレート（docs/03-duty-log-review-account.md「テンプレート（2026/11 確定）」）。
 * DB には持たずコード定数として扱い、テンプレートから作った Duty は通常の Duty と区別しない
 * （`id` は画面上の識別用で、DB には保存しない）。
 *
 * テンプレートを選んでも即登録はせず、`scheduleConfig` を初期値として追加シートを開く。
 * ゴミ出しの曜日のように初期値を決められない設定は空のままにしてあり、
 * `scheduleConfigSchema` を通らないため、入力するまで「追加する」を押せない。
 */
export interface DutyTemplate {
  id: string;
  name: string;
  icon: PresetIconName;
  scheduleConfig: ScheduleConfig;
}

export const DUTY_TEMPLATES: readonly DutyTemplate[] = [
  {
    id: "garbage",
    name: "ゴミ出し",
    icon: "trash-2",
    scheduleConfig: { type: "WEEKDAYS", weekdays: [] },
  },
  {
    id: "bath",
    name: "お風呂",
    icon: "bath",
    scheduleConfig: { type: "SINCE_LAST", days: 2 },
  },
  {
    id: "protein",
    name: "プロテイン",
    icon: "cup-soda",
    scheduleConfig: { type: "DAILY" },
  },
  {
    id: "supplement",
    name: "サプリ",
    icon: "pill",
    scheduleConfig: { type: "DAILY" },
  },
  {
    id: "english",
    name: "英語学習",
    icon: "book-open",
    scheduleConfig: { type: "WEEKLY_COUNT", timesPerWeek: 2 },
  },
  {
    id: "sheets",
    name: "シーツ交換",
    icon: "bed-double",
    scheduleConfig: { type: "SINCE_LAST", days: 14 },
  },
  {
    id: "wet-areas",
    name: "水回り掃除",
    icon: "shower-head",
    scheduleConfig: { type: "SINCE_LAST", days: 7 },
  },
  {
    id: "vacuum",
    name: "掃除機がけ",
    icon: "brush",
    scheduleConfig: { type: "SINCE_LAST", days: 5 },
  },
  {
    id: "aircon-filter",
    name: "エアコンフィルター掃除",
    icon: "air-vent",
    scheduleConfig: { type: "MONTHLY", dayOfMonth: 1 },
  },
  {
    id: "family-call",
    name: "家族への連絡",
    icon: "phone",
    scheduleConfig: { type: "WEEKLY_COUNT", timesPerWeek: 1 },
  },
];
