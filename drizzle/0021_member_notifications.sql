CREATE TABLE IF NOT EXISTS `member_notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL,
  `member_id` text NOT NULL,
  `event_type` text NOT NULL,
  `category` text DEFAULT 'NEWS' NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `sender` text DEFAULT 'COMPASSION WORLD' NOT NULL,
  `channel` text DEFAULT 'CARD' NOT NULL,
  `delivery_status` text DEFAULT 'SAVED' NOT NULL,
  `external_message_id` text,
  `error_message` text,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `read_at` integer,
  `occurred_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `member_notifications_event_unique` ON `member_notifications` (`event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `member_notifications_member_created_idx` ON `member_notifications` (`member_id`,`created_at`);
