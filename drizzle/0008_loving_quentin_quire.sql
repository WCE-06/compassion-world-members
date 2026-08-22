CREATE TABLE `legacy_member_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`line_user_id` text,
	`display_name` text,
	`display_name_kana` text,
	`phone` text,
	`email` text,
	`birth_date` text,
	`gender` text,
	`postal_code` text,
	`prefecture` text,
	`address` text,
	`source_registered_at` text,
	`status` text DEFAULT 'UNREGISTERED' NOT NULL,
	`imported_at` integer NOT NULL,
	`migrated_member_id` text,
	FOREIGN KEY (`migrated_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_import_line_user_unique` ON `legacy_member_imports` (`line_user_id`);--> statement-breakpoint
CREATE INDEX `legacy_import_status_idx` ON `legacy_member_imports` (`status`);--> statement-breakpoint
ALTER TABLE `members` ADD `display_name_kana` text;--> statement-breakpoint
ALTER TABLE `members` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `members` ADD `email` text;--> statement-breakpoint
ALTER TABLE `members` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `members` ADD `gender` text;--> statement-breakpoint
ALTER TABLE `members` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `members` ADD `prefecture` text;--> statement-breakpoint
ALTER TABLE `members` ADD `address` text;--> statement-breakpoint
ALTER TABLE `members` ADD `points_balance` integer DEFAULT 0 NOT NULL;