ALTER TABLE `inventory_product_settings` ADD `product_id` text DEFAULT '' NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `category_id` text DEFAULT '' NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `price` integer DEFAULT 0 NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `cost` real DEFAULT 0 NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `display_flag` integer DEFAULT 1 NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `stock_control_division` text DEFAULT '0' NOT NULL;
ALTER TABLE `inventory_product_settings` ADD `tags` text DEFAULT '' NOT NULL;
CREATE INDEX `inventory_product_settings_category_idx` ON `inventory_product_settings` (`category_id`,`product_name`);
