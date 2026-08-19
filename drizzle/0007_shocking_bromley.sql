ALTER TABLE `business_calendar` ADD `continuous_start` text DEFAULT '11:30' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_calendar` ADD `continuous_end` text DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `business_calendar` ADD `continuous_last_order` text DEFAULT '21:30' NOT NULL;