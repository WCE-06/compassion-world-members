CREATE TABLE `purchase_devices` (
  `id` text PRIMARY KEY NOT NULL,
  `device_id` text NOT NULL,
  `display_name` text NOT NULL,
  `token_hash` text NOT NULL,
  `scopes_json` text DEFAULT '[]' NOT NULL,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `last_used_at` integer,
  `revoked_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_devices_device_unique` ON `purchase_devices` (`device_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_devices_token_unique` ON `purchase_devices` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `purchase_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `purchase_id` text NOT NULL,
  `version` integer NOT NULL,
  `object_key` text NOT NULL,
  `content_type` text NOT NULL,
  `source_data_hash` text NOT NULL,
  `status` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_artifacts_purchase_version_unique` ON `purchase_artifacts` (`purchase_id`,`version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_artifacts_object_unique` ON `purchase_artifacts` (`object_key`);
