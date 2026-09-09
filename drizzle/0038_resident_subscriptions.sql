CREATE TABLE IF NOT EXISTS `resident_subscriptions` (
	`member_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`stripe_price_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`last_stripe_event_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `resident_subscriptions_subscription_unique` ON `resident_subscriptions` (`stripe_subscription_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `resident_subscriptions_customer_idx` ON `resident_subscriptions` (`stripe_customer_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `resident_subscriptions_status_idx` ON `resident_subscriptions` (`status`);
