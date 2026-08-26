import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import type { ScheduleConfig, ScheduleType, DutyStatus, LogStatus, NotifyChannel } from "@zumi/types";
import { user } from "./auth-schema";

export const userSettings = sqliteTable("user_settings", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  morningNotifyEnabled: integer("morning_notify_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  morningNotifyAt: text("morning_notify_at"), // "08:00"
  eveningNotifyEnabled: integer("evening_notify_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  eveningNotifyAt: text("evening_notify_at"), // "21:00"
  weeklySummaryEnabled: integer("weekly_summary_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  weeklySummaryWeekday: integer("weekly_summary_weekday").notNull().default(0), // 0=日
  weeklySummaryAt: text("weekly_summary_at").notNull().default("20:00"),
  channel: text("channel").$type<NotifyChannel>().notNull().default("WEB_PUSH"),
  lineUserId: text("line_user_id"), // Pro のみ
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const duties = sqliteTable(
  "duties",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    icon: text("icon").notNull(),
    scheduleType: text("schedule_type").$type<ScheduleType>().notNull(),
    scheduleConfig: text("schedule_config", { mode: "json" }).$type<ScheduleConfig>().notNull(),
    notifyPrevNight: integer("notify_prev_night", { mode: "boolean" }).notNull().default(false),
    noteEnabled: integer("note_enabled", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    status: text("status").$type<DutyStatus>().notNull().default("ACTIVE"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => ({
    byUserStatus: index("duties_user_status_idx").on(t.userId, t.status),
  }),
);

export const logs = sqliteTable(
  "logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dutyId: text("duty_id")
      .notNull()
      .references(() => duties.id, { onDelete: "cascade" }),
    targetDate: text("target_date").notNull(), // "2026-08-24"
    loggedAt: integer("logged_at", { mode: "timestamp" }).notNull(),
    status: text("status").$type<LogStatus>().notNull(),
    note: text("note"),
  },
  (t) => ({
    uniqDutyDate: uniqueIndex("logs_duty_date_uniq").on(t.dutyId, t.targetDate),
    byUserDate: index("logs_user_date_idx").on(t.userId, t.targetDate),
  }),
);

export * from "./auth-schema";
