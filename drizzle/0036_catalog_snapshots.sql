CREATE TABLE `catalog_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `products_json` text NOT NULL,
  `sync_json` text DEFAULT '{}' NOT NULL,
  `product_count` integer NOT NULL,
  `source_updated_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
