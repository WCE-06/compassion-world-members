CREATE TABLE `kitchen_test_orders` (
	`order_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kitchen_unit_counters` (
	`call_date` text NOT NULL,
	`department` text NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_unit_counters_date_department_unique` ON `kitchen_unit_counters` (`call_date`,`department`);
--> statement-breakpoint
CREATE TABLE `kitchen_units` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`order_item_id` text NOT NULL,
	`unit_index` integer NOT NULL,
	`department` text NOT NULL,
	`call_date` text NOT NULL,
	`call_number` integer NOT NULL,
	`status` text DEFAULT 'ACCEPTED' NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`total_steps` integer DEFAULT 1 NOT NULL,
	`is_test` integer DEFAULT false NOT NULL,
	`ready_at` integer,
	`called_at` integer,
	`picked_up_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_units_item_index_unique` ON `kitchen_units` (`order_item_id`,`unit_index`);
--> statement-breakpoint
CREATE UNIQUE INDEX `kitchen_units_call_unique` ON `kitchen_units` (`call_date`,`department`,`call_number`);
--> statement-breakpoint
CREATE INDEX `kitchen_units_status_idx` ON `kitchen_units` (`department`,`status`,`updated_at`);
--> statement-breakpoint
PRAGMA optimize;
