CREATE TABLE `staff_accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'STORE' NOT NULL,
	`status` text DEFAULT 'INVITED' NOT NULL,
	`invite_token_hash` text,
	`invite_expires_at` integer,
	`invited_by` text NOT NULL,
	`invited_at` integer NOT NULL,
	`accepted_at` integer,
	`last_login_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `staff_accounts_status_idx` ON `staff_accounts` (`status`,`role`);
