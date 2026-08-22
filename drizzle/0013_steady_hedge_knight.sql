CREATE TABLE `order_payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`order_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`lock_id` text,
	`device_id` text,
	`paid_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_payment_events_request_unique` ON `order_payment_events` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `order_payment_events_payment_unique` ON `order_payment_events` (`payment_id`);--> statement-breakpoint
CREATE INDEX `order_payment_events_order_idx` ON `order_payment_events` (`order_id`);--> statement-breakpoint
CREATE TABLE `order_payment_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`request_id` text NOT NULL,
	`device_id` text NOT NULL,
	`status` text NOT NULL,
	`locked_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`released_at` integer,
	`release_reason` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_payment_locks_request_unique` ON `order_payment_locks` (`request_id`);--> statement-breakpoint
CREATE INDEX `order_payment_locks_order_status_idx` ON `order_payment_locks` (`order_id`,`status`,`expires_at`);--> statement-breakpoint
ALTER TABLE `order_items` ADD `unit_price_excluding_tax` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `tax_rate` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `tax_division` text DEFAULT 'INCLUDED' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `tax_rounding` text DEFAULT 'FLOOR' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `selected_options_json` text DEFAULT '[]' NOT NULL;