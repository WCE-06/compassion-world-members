CREATE TABLE `inventory_suppliers` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `normalized_name` text NOT NULL,
  `last_used_at` integer NOT NULL,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
CREATE UNIQUE INDEX `inventory_suppliers_normalized_name_unique` ON `inventory_suppliers` (`normalized_name`);
CREATE INDEX `inventory_suppliers_last_used_idx` ON `inventory_suppliers` (`last_used_at`);

CREATE TABLE `inventory_purchase_prices` (
  `id` text PRIMARY KEY NOT NULL,
  `lot_id` text NOT NULL,
  `product_code` text NOT NULL,
  `product_name` text NOT NULL,
  `supplier_id` text NOT NULL,
  `supplier_name` text NOT NULL,
  `unit_price` integer NOT NULL,
  `is_limited_price` integer DEFAULT 0 NOT NULL,
  `purchased_at` integer NOT NULL,
  `created_by` text NOT NULL,
  FOREIGN KEY (`lot_id`) REFERENCES `inventory_lots`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`supplier_id`) REFERENCES `inventory_suppliers`(`id`) ON UPDATE no action ON DELETE restrict
);
CREATE INDEX `inventory_purchase_prices_product_supplier_idx` ON `inventory_purchase_prices` (`product_code`,`supplier_id`,`purchased_at`);
CREATE INDEX `inventory_purchase_prices_product_price_idx` ON `inventory_purchase_prices` (`product_code`,`unit_price`);
