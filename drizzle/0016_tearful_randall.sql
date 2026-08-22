CREATE TABLE `member_spend_snapshots` (
	`member_id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'SMAREGI' NOT NULL,
	`qualifying_spend_excluding_tax` integer NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`source_revision` text,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `member_spend_snapshots_synced_idx` ON `member_spend_snapshots` (`synced_at`);