CREATE TABLE `identity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_user_id` text NOT NULL,
	`linked_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `identity_provider_user_unique` ON `identity_links` (`provider`,`provider_user_id`);--> statement-breakpoint
CREATE INDEX `identity_member_idx` ON `identity_links` (`member_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`member_code` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`source_system` text DEFAULT 'LEGACY' NOT NULL,
	`source_customer_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_member_code_unique` ON `members` (`member_code`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`studio_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reservations_member_start_idx` ON `reservations` (`member_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `studio_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text,
	`member_id` text NOT NULL,
	`studio_id` text NOT NULL,
	`checked_in_at` integer,
	`checked_out_at` integer,
	`status` text NOT NULL,
	`payment_status` text DEFAULT 'UNPAID' NOT NULL,
	`payment_id` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_member_status_idx` ON `studio_sessions` (`member_id`,`status`);