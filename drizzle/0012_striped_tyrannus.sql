CREATE TABLE `stripe_customers` (
	`member_id` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`default_payment_method_id` text,
	`card_brand` text,
	`card_last4` text,
	`card_exp_month` integer,
	`card_exp_year` integer,
	`reusable_consent_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customers_customer_unique` ON `stripe_customers` (`stripe_customer_id`);--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `stripe_checkout_session_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_stripe_checkout_session_unique` ON `orders` (`stripe_checkout_session_id`);