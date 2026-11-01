import type { DutyLog, DutyPause, DutyTemplate, PresetIconName, WeekStart } from "@zumi/types";
import { DUTY_NAME_MAX_LENGTH, type DutyInput } from "@/lib/duty-input";
import { draftFromConfig, toScheduleConfig, type ScheduleDraft } from "@/lib/schedule-draft";

/** 追加シート・編集フォームで編集中の Duty */
export interface DutyDraft {
  name: string;
  icon: PresetIconName;
  schedule: ScheduleDraft;
  notifyPrevNight: boolean;
  noteEnabled: boolean;
}

/**
 * 「次の期日」のプレビューに使う暦と、既存 Duty の状態。
 * 作成前は `createdAt` を現在時刻、`logs`・`pauses` を空にする。
 */
export interface DutyFormContext {
  today: string;
  timeZone: string;
  weekStart: WeekStart;
  createdAt: Date;
  logs: readonly Pick<DutyLog, "targetDate" | "status">[];
  pauses: readonly Pick<DutyPause, "startDate" | "endDate">[];
}

const DEFAULT_ICON: PresetIconName = "sparkles";

export function emptyDutyDraft(today: string): DutyDraft {
  return {
    name: "",
    icon: DEFAULT_ICON,
    schedule: draftFromConfig({ type: "DAILY" }, today),
    notifyPrevNight: false,
    noteEnabled: false,
  };
}

export function dutyDraftFromTemplate(template: DutyTemplate, today: string): DutyDraft {
  return {
    ...emptyDutyDraft(today),
    name: template.name,
    icon: template.icon,
    schedule: draftFromConfig(template.scheduleConfig, today),
  };
}

/** 送信できる形にする。名前が空・繰り返しが未入力なら null（「追加する」を押せない） */
export function toDutyInput(draft: DutyDraft): DutyInput | null {
  const name = draft.name.trim();
  const scheduleConfig = toScheduleConfig(draft.schedule);
  if (!name || name.length > DUTY_NAME_MAX_LENGTH || !scheduleConfig) return null;
  return {
    name,
    icon: draft.icon,
    scheduleConfig,
    notifyPrevNight: draft.notifyPrevNight,
    noteEnabled: draft.noteEnabled,
  };
}
