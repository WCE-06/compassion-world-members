CREATE TABLE `payment_point_events` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`member_id` text NOT NULL,
	`purpose` text NOT NULL,
	`source_id` text NOT NULL,
	`stripe_event_id` text,
	`stripe_payment_id` text,
	`smaregi_transaction_id` text,
	`eligible` integer NOT NULL,
	`status` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_point_events_idempotency_unique` ON `payment_point_events` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_point_events_stripe_event_unique` ON `payment_point_events` (`stripe_event_id`);--> statement-breakpoint
CREATE INDEX `payment_point_events_source_idx` ON `payment_point_events` (`purpose`,`source_id`);--> statement-breakpoint
ALTER TABLE `orders` ADD `point_eligible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `point_status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `points_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_payment_intent_id` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `smaregi_transaction_id` text;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `payment_method` text;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `point_eligible` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `point_status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `points_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `studio_sessions` ADD `smaregi_transaction_id` text;