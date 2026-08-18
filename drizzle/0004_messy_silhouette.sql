CREATE TABLE `catalog_overrides` (
	`product_code` text PRIMARY KEY NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`menu_category` text NOT NULL,
	`display_sequence` integer DEFAULT 9999 NOT NULL,
	`show_on_self_register` integer DEFAULT true NOT NULL,
	`show_on_mobile_order` integer DEFAULT true NOT NULL,
	`sold_out` integer DEFAULT false NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `catalog_overrides_category_sequence_idx` ON `catalog_overrides` (`menu_category`,`display_sequence`);