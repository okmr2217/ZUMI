ALTER TABLE `user_settings` ADD `timezone_auto` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `user_settings_morning_notify_idx` ON `user_settings` (`morning_notify_at`) WHERE "user_settings"."morning_notify_enabled" = 1;--> statement-breakpoint
CREATE INDEX `user_settings_evening_notify_idx` ON `user_settings` (`evening_notify_at`) WHERE "user_settings"."evening_notify_enabled" = 1;--> statement-breakpoint
CREATE INDEX `user_settings_weekly_summary_idx` ON `user_settings` (`weekly_summary_at`) WHERE "user_settings"."weekly_summary_enabled" = 1;--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);