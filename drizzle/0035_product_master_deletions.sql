CREATE TABLE `product_master_deletions` (
  `product_code` text PRIMARY KEY NOT NULL,
  `product_name` text NOT NULL,
  `deleted_by` text NOT NULL,
  `deleted_at` integer NOT NULL
);
