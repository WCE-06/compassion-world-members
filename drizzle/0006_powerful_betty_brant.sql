CREATE TABLE `business_calendar` (
	`date` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'DEFAULT' NOT NULL,
	`lunch_enabled` integer DEFAULT true NOT NULL,
	`dinner_enabled` integer DEFAULT false NOT NULL,
	`lunch_start` text DEFAULT '11:30' NOT NULL,
	`lunch_end` text DEFAULT '14:00' NOT NULL,
	`dinner_start` text DEFAULT '17:30' NOT NULL,
	`dinner_end` text DEFAULT '22:00' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `business_calendar_status_idx` ON `business_calendar` (`status`);--> statement-breakpoint
CREATE TABLE `category_schedules` (
	`category` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`start_time` text DEFAULT '11:30' NOT NULL,
	`end_time` text DEFAULT '14:00' NOT NULL,
	`days` text DEFAULT '1,2,3,4,5,6,7' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `store_hours` ADD `lunch_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `lunch_start` text DEFAULT '11:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `lunch_end` text DEFAULT '14:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `lunch_last_order` text DEFAULT '13:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `lunch_days` text DEFAULT '2,3,4,5,6,7' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `dinner_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `dinner_start` text DEFAULT '17:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `dinner_end` text DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `dinner_last_order` text DEFAULT '21:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `dinner_days` text DEFAULT '6' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_hours` ADD `event_dinner_enabled` integer DEFAULT true NOT NULL;