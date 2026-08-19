CREATE TABLE `store_hours` (
	`id` text PRIMARY KEY DEFAULT 'AOZORA_KITCHEN' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`timezone` text DEFAULT 'Asia/Tokyo' NOT NULL,
	`open_time` text DEFAULT '11:00' NOT NULL,
	`close_time` text DEFAULT '20:00' NOT NULL,
	`order_start` text DEFAULT '11:00' NOT NULL,
	`last_order` text DEFAULT '19:30' NOT NULL,
	`business_days` text DEFAULT '1,2,3,4,5,6,7' NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `schedule_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `schedule_start` text DEFAULT '11:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `schedule_end` text DEFAULT '20:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `schedule_days` text DEFAULT '1,2,3,4,5,6,7' NOT NULL;