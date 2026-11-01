CREATE TABLE `duty_pauses` (
	`id` text PRIMARY KEY NOT NULL,
	`duty_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	FOREIGN KEY (`duty_id`) REFERENCES `duties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `duty_pauses_duty_idx` ON `duty_pauses` (`duty_id`);--> statement-breakpoint
ALTER TABLE `duties` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `week_start` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `onboarded_at` integer;--> statement-breakpoint
ALTER TABLE `user_settings` DROP COLUMN `weekly_summary_weekday`;--> statement-breakpoint
-- フェーズ1で作成済みのユーザーには user_settings の行がないため補完する
-- （以後はサインアップ時に better-auth の databaseHooks で作成する）。
INSERT INTO `user_settings` (`id`, `user_id`) SELECT lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), `id` FROM `user` WHERE `id` NOT IN (SELECT `user_id` FROM `user_settings`);
