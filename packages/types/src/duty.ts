import type { ScheduleConfig, ScheduleType } from "./schedule";

export type DutyStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type LogStatus = "DONE" | "SKIP";
export type NotifyChannel = "WEB_PUSH" | "EMAIL" | "LINE";
/** 週の始まり。`Date#getDay()` と同じく 1=月 / 0=日。初期値は月曜 */
export type WeekStart = 0 | 1;

export interface Duty {
  id: string;
  userId: string;
  name: string;
  icon: string;
  scheduleType: ScheduleType;
  scheduleConfig: ScheduleConfig;
  notifyPrevNight: boolean;
  noteEnabled: boolean;
  sortOrder: number;
  status: DutyStatus;
  createdAt: Date;
  archivedAt: Date | null;
}

/** 一時停止の期間。過去の週の分母から PAUSED 期間を外すために使う */
export interface DutyPause {
  id: string;
  dutyId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string | null; // null = 一時停止中
}

export interface DutyLog {
  id: string;
  userId: string;
  dutyId: string;
  targetDate: string; // "YYYY-MM-DD"
  loggedAt: Date;
  status: LogStatus;
  note: string | null;
}
