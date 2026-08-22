CREATE TABLE `order_call_counters` (
	`call_date` text NOT NULL,
	`department` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_call_counters_date_department_unique` ON `order_call_counters` (`call_date`,`department`);--> statement-breakpoint
CREATE TABLE `order_fulfillments` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`department` text NOT NULL,
	`call_date` text NOT NULL,
	`call_number` integer NOT NULL,
	`status` text DEFAULT 'ACCEPTED' NOT NULL,
	`ready_at` integer,
	`called_at` integer,
	`picked_up_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_fulfillments_order_department_unique` ON `order_fulfillments` (`order_id`,`department`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_fulfillments_call_unique` ON `order_fulfillments` (`call_date`,`department`,`call_number`);--> statement-breakpoint
CREATE INDEX `order_fulfillments_status_idx` ON `order_fulfillments` (`department`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `order_items` ADD `department` text DEFAULT 'FOOD' NOT NULL;