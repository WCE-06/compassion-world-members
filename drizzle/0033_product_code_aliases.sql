CREATE TABLE `product_code_aliases` (
  `old_code` text PRIMARY KEY NOT NULL,
  `new_code` text NOT NULL,
  `product_id` text NOT NULL,
  `product_name` text NOT NULL,
  `migrated_at` integer NOT NULL,
  `migrated_by` text NOT NULL
);
CREATE UNIQUE INDEX `product_code_aliases_new_code_idx` ON `product_code_aliases` (`new_code`);
CREATE UNIQUE INDEX `product_code_aliases_product_id_idx` ON `product_code_aliases` (`product_id`);
