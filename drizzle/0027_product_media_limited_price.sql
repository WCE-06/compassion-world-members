ALTER TABLE `inventory_product_settings` ADD `category_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `limited_price` integer;
--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `limited_price_starts_at` integer;
--> statement-breakpoint
ALTER TABLE `catalog_overrides` ADD `limited_price_ends_at` integer;
