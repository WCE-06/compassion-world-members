CREATE TABLE `receipt_devices` (
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
CREATE UNIQUE INDEX `receipt_devices_device_unique` ON `receipt_devices` (`device_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_devices_token_unique` ON `receipt_devices` (`token_hash`);
--> statement-breakpoint
CREATE TABLE `purchases` (
  `id` text PRIMARY KEY NOT NULL,
  `receipt_id` text NOT NULL,
  `request_id` text NOT NULL,
  `transaction_id` text NOT NULL,
  `member_id` text NOT NULL,
  `member_code_hash` text NOT NULL,
  `store_id` text NOT NULL,
  `store_name` text NOT NULL,
  `transaction_date_time` integer NOT NULL,
  `status` text NOT NULL,
  `receipt_mode` text NOT NULL,
  `currency` text DEFAULT 'JPY' NOT NULL,
  `subtotal` integer NOT NULL,
  `tax_total` integer NOT NULL,
  `total_including_tax` integer NOT NULL,
  `points_used` integer DEFAULT 0 NOT NULL,
  `payment_method` text NOT NULL,
  `payment_breakdown_json` text DEFAULT '{}' NOT NULL,
  `receipt_version` integer DEFAULT 1 NOT NULL,
  `source_data_hash` text NOT NULL,
  `source_device_id` text NOT NULL,
  `confirmed_at` integer,
  `cancelled_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_receipt_unique` ON `purchases` (`receipt_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_transaction_unique` ON `purchases` (`transaction_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_request_unique` ON `purchases` (`request_id`);
--> statement-breakpoint
CREATE INDEX `purchases_member_date_idx` ON `purchases` (`member_id`,`transaction_date_time`);
--> statement-breakpoint
CREATE INDEX `purchases_status_updated_idx` ON `purchases` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `purchase_items` (
  `id` text PRIMARY KEY NOT NULL,
  `purchase_id` text NOT NULL,
  `line_number` integer NOT NULL,
  `product_code` text NOT NULL,
  `product_name` text NOT NULL,
  `quantity` integer NOT NULL,
  `unit_price_including_tax` integer NOT NULL,
  `line_total` integer NOT NULL,
  `tax_rate` integer NOT NULL,
  `options_json` text DEFAULT '[]' NOT NULL,
  FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_items_purchase_line_unique` ON `purchase_items` (`purchase_id`,`line_number`);
--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);
--> statement-breakpoint
CREATE TABLE `purchase_adjustments` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `purchase_id` text NOT NULL,
  `type` text NOT NULL,
  `source_transaction_id` text NOT NULL,
  `amount` integer NOT NULL,
  `reason` text,
  `items_json` text DEFAULT '[]' NOT NULL,
  `source_data_hash` text NOT NULL,
  `source_device_id` text NOT NULL,
  `occurred_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_adjustments_request_unique` ON `purchase_adjustments` (`request_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_adjustments_source_transaction_unique` ON `purchase_adjustments` (`source_transaction_id`);
--> statement-breakpoint
CREATE INDEX `purchase_adjustments_purchase_idx` ON `purchase_adjustments` (`purchase_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE `receipt_artifacts` (
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
CREATE UNIQUE INDEX `receipt_artifacts_purchase_version_unique` ON `receipt_artifacts` (`purchase_id`,`version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_artifacts_object_unique` ON `receipt_artifacts` (`object_key`);
--> statement-breakpoint
CREATE TABLE `purchase_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_type` text NOT NULL,
  `actor_id_hash` text NOT NULL,
  `action` text NOT NULL,
  `receipt_id` text,
  `transaction_id_hash` text,
  `device_id` text,
  `result` text NOT NULL,
  `reason` text,
  `occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `purchase_audit_receipt_idx` ON `purchase_audit_logs` (`receipt_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `purchase_audit_action_idx` ON `purchase_audit_logs` (`action`,`occurred_at`);
