import {
  addDays,
  getWeekday,
  scheduleConfigSchema,
  type MonthlyNth,
  type ScheduleConfig,
} from "@zumi/types";

/**
 * 繰り返し設定の編集中の状態。docs/03「繰り返しタイプの選択UI（自由入力時）」の2段階の選択に合わせ、
 * 第1段階は5択（`kind`）、`NTH_WEEK` は「曜日が決まっている」の詳細で「隔週にする」を選んだ形にする。
 *
 * 選択肢を切り替えても入力した値が消えないよう、全タイプの値を同時に持つ。
 * ゴミ出しのテンプレートの曜日のように未入力の状態も表せるので、保存前に `toScheduleConfig` で検証する。
 */
export type RepeatKind = "DAILY" | "WEEKDAYS" | "MONTHLY" | "WEEKLY_COUNT" | "SINCE_LAST";

export const REPEAT_KIND_OPTIONS: readonly { kind: RepeatKind; label: string }[] = [
  { kind: "DAILY", label: "毎日やる" },
  { kind: "WEEKDAYS", label: "曜日が決まっている" },
  { kind: "MONTHLY", label: "毎月やる" },
  { kind: "WEEKLY_COUNT", label: "週に何回か" },
  { kind: "SINCE_LAST", label: "前回から◯日空いたら" },
];

export interface ScheduleDraft {
  kind: RepeatKind;
  weekdays: number[];
  biweekly: boolean;
  /** 隔週の起点日。`anchorTouched` が false の間は曜日に合わせて自動で決める */
  anchor: string;
  anchorTouched: boolean;
  monthlyMode: "DAY" | "NTH";
  dayOfMonth: number;
  nth: MonthlyNth;
  nthWeekday: number;
  timesPerWeek: number;
  sinceDays: number;
}

/**
 * 隔週の起点日の初期値: 選んだ曜日のうち、今日以降で最初に来る日。
 * 期日計算は起点日より前を期日にしないため、今日より前にはしない。曜日が未選択なら今日。
 */
export function defaultAnchor(weekdays: readonly number[], today: string): string {
  for (let i = 0; i < 7; i++) {
    const date = addDays(today, i);
    if (weekdays.includes(getWeekday(date))) return date;
  }
  return today;
}

export function draftFromConfig(config: ScheduleConfig, today: string): ScheduleDraft {
  const draft: ScheduleDraft = {
    kind: "DAILY",
    weekdays: [],
    biweekly: false,
    anchor: today,
    anchorTouched: false,
    monthlyMode: "DAY",
    dayOfMonth: Number(today.slice(8, 10)),
    nth: 1,
    nthWeekday: getWeekday(today),
    timesPerWeek: 2,
    sinceDays: 3,
  };
  switch (config.type) {
    case "DAILY":
      return draft;
    case "WEEKDAYS":
      return {
        ...draft,
        kind: "WEEKDAYS",
        weekdays: [...config.weekdays],
        anchor: defaultAnchor(config.weekdays, today),
      };
    case "NTH_WEEK":
      return {
        ...draft,
        kind: "WEEKDAYS",
        weekdays: [...config.weekdays],
        biweekly: true,
        anchor: config.anchor,
        anchorTouched: true,
      };
    case "MONTHLY":
      return "dayOfMonth" in config
        ? { ...draft, kind: "MONTHLY", dayOfMonth: config.dayOfMonth }
        : {
            ...draft,
            kind: "MONTHLY",
            monthlyMode: "NTH",
            nth: config.nth,
            nthWeekday: config.weekday,
          };
    case "WEEKLY_COUNT":
      return { ...draft, kind: "WEEKLY_COUNT", timesPerWeek: config.timesPerWeek };
    case "SINCE_LAST":
      return { ...draft, kind: "SINCE_LAST", sinceDays: config.days };
  }
}

/** 曜日を切り替える。起点日を手で選んでいなければ、選んだ曜日に合わせて決め直す */
export function toggleWeekday(draft: ScheduleDraft, weekday: number, today: string): ScheduleDraft {
  const weekdays = draft.weekdays.includes(weekday)
    ? draft.weekdays.filter((day) => day !== weekday)
    : [...draft.weekdays, weekday].sort((a, b) => a - b);
  return {
    ...draft,
    weekdays,
    anchor: draft.anchorTouched ? draft.anchor : defaultAnchor(weekdays, today),
  };
}

/** 編集中の状態から `ScheduleConfig` を作る。曜日が未選択などで検証を通らなければ null */
export function toScheduleConfig(draft: ScheduleDraft): ScheduleConfig | null {
  const candidate = (() => {
    switch (draft.kind) {
      case "DAILY":
        return { type: "DAILY" };
      case "WEEKDAYS":
        return draft.biweekly
          ? { type: "NTH_WEEK", weekdays: draft.weekdays, every: 2, anchor: draft.anchor }
          : { type: "WEEKDAYS", weekdays: draft.weekdays };
      case "MONTHLY":
        return draft.monthlyMode === "DAY"
          ? { type: "MONTHLY", dayOfMonth: draft.dayOfMonth }
          : { type: "MONTHLY", nth: draft.nth, weekday: draft.nthWeekday };
      case "WEEKLY_COUNT":
        return { type: "WEEKLY_COUNT", timesPerWeek: draft.timesPerWeek };
      case "SINCE_LAST":
        return { type: "SINCE_LAST", days: draft.sinceDays };
    }
  })();
  const parsed = scheduleConfigSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
