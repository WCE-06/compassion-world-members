CREATE TABLE `member_registration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`event_type` text NOT NULL,
	`actor` text NOT NULL,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_registration_events_member_idx` ON `member_registration_events` (`member_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `member_registration_syncs` (
	`member_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`source_customer_id` text,
	`last_error` text,
	`last_request_id` text,
	`synced_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_registration_sync_status_idx` ON `member_registration_syncs` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `member_terms_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`privacy_version` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_terms_member_idx` ON `member_terms_acceptances` (`member_id`,`accepted_at`);