ALTER TABLE `members` ADD `resident_status` text DEFAULT 'UNKNOWN' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `resident_checked_at` integer;