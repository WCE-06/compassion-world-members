CREATE TABLE `pos_payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`session_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`source` text NOT NULL,
	`total_excluding_tax` integer NOT NULL,
	`tax_amount` integer NOT NULL,
	`total_including_tax` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `studio_sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pos_payment_events_idempotency_unique` ON `pos_payment_events` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `pos_payment_events_payment_id_unique` ON `pos_payment_events` (`payment_id`);--> statement-breakpoint
CREATE INDEX `pos_payment_events_session_idx` ON `pos_payment_events` (`session_id`);--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `scheduled_ends_at` integer;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `plan_type` text;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `product_code` text;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `unit_price_excluding_tax` integer;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `tax_rate_bps` integer;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `total_excluding_tax` integer;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `tax_amount` integer;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `total_including_tax` integer;