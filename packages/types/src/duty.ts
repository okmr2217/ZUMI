import type { ScheduleConfig, ScheduleType } from "./schedule";

export type DutyStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type LogStatus = "DONE" | "SKIP";
export type NotifyChannel = "WEB_PUSH" | "EMAIL" | "LINE";

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
