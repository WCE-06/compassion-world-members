CREATE TABLE `member_policy_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`consent_type` text NOT NULL,
	`source` text DEFAULT 'MEMBER_CARD' NOT NULL,
	`agreed_at` integer NOT NULL,
	`user_agent` text,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_policy_consents_member_version_unique` ON `member_policy_consents` (`member_id`,`terms_version`,`consent_type`);--> statement-breakpoint
CREATE INDEX `member_policy_consents_member_idx` ON `member_policy_consents` (`member_id`,`agreed_at`);--> statement-breakpoint
CREATE TABLE `member_rank_events` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`event_type` text NOT NULL,
	`previous_rank` text,
	`next_rank` text NOT NULL,
	`qualifying_spend_excluding_tax` integer NOT NULL,
	`source` text NOT NULL,
	`source_revision` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_rank_events_member_idx` ON `member_rank_events` (`member_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `member_rank_states` (
	`member_id` text PRIMARY KEY NOT NULL,
	`current_rank` text NOT NULL,
	`current_rate_percent` integer NOT NULL,
	`rank_period_started_at` integer NOT NULL,
	`rank_period_ends_at` integer NOT NULL,
	`qualifying_spend_excluding_tax` integer DEFAULT 0 NOT NULL,
	`rank_updated_at` integer NOT NULL,
	`next_review_at` integer NOT NULL,
	`membership_type` text DEFAULT 'GENERAL' NOT NULL,
	`resident_plan_active` integer DEFAULT false NOT NULL,
	`spend_source` text DEFAULT 'NOT_SYNCED' NOT NULL,
	`spend_source_revision` text,
	`spend_synced_at` integer,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_rank_states_review_idx` ON `member_rank_states` (`next_review_at`);