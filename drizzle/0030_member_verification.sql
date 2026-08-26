ALTER TABLE `members` ADD `verification_status` text DEFAULT 'ACTIVE' NOT NULL;
--> statement-breakpoint
UPDATE `members` SET `verification_status`='SUSPENDED' WHERE `status`='INACTIVE';
--> statement-breakpoint
CREATE TABLE `member_verification_audits` (
  `request_id` text PRIMARY KEY NOT NULL,
  `request_fingerprint` text NOT NULL,
  `system` text NOT NULL,
  `device_id` text NOT NULL,
  `token_scope` text NOT NULL,
  `member_code_hash` text NOT NULL,
  `result` text NOT NULL,
  `http_status` integer NOT NULL,
  `duration_ms` integer NOT NULL,
  `response_json` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `member_verification_audits_system_created_idx` ON `member_verification_audits` (`system`,`created_at`);
