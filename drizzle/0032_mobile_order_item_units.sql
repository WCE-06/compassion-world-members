CREATE TABLE IF NOT EXISTS `mobile_order_migration_audits` (
  `id` text PRIMARY KEY NOT NULL,
  `reason` text NOT NULL,
  `target_count` integer NOT NULL,
  `order_numbers_json` text NOT NULL,
  `executed_at` integer NOT NULL
);

INSERT OR IGNORE INTO `mobile_order_migration_audits`
  (`id`,`reason`,`target_count`,`order_numbers_json`,`executed_at`)
SELECT
  'MOBILE_ORDER_ITEM_UNIT_MIGRATION_V1',
  'MOBILE_ORDER_ITEM_UNIT_MIGRATION',
  COUNT(*),
  COALESCE(json_group_array(order_number),'[]'),
  CAST(strftime('%s','now') AS integer)*1000
FROM `orders`
WHERE payment_method='STORE'
  AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING')
  AND smaregi_transaction_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM kitchen_test_orders t WHERE t.order_id=orders.id);

UPDATE `order_payment_locks`
SET status='RELEASED',
    released_at=CAST(strftime('%s','now') AS integer)*1000,
    release_reason='MOBILE_ORDER_ITEM_UNIT_MIGRATION'
WHERE status='ACTIVE'
  AND order_id IN (
    SELECT id FROM orders
    WHERE payment_method='STORE'
      AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING')
      AND smaregi_transaction_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM kitchen_test_orders t WHERE t.order_id=orders.id)
  );

UPDATE `order_fulfillments`
SET status='CANCELLED',updated_at=CAST(strftime('%s','now') AS integer)*1000
WHERE order_id IN (
  SELECT id FROM orders
  WHERE payment_method='STORE'
    AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING')
    AND smaregi_transaction_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kitchen_test_orders t WHERE t.order_id=orders.id)
);

UPDATE `kitchen_units`
SET status='CANCELLED',updated_at=CAST(strftime('%s','now') AS integer)*1000
WHERE order_id IN (
  SELECT id FROM orders
  WHERE payment_method='STORE'
    AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING')
    AND smaregi_transaction_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM kitchen_test_orders t WHERE t.order_id=orders.id)
);

UPDATE `orders`
SET status='CANCELLED',updated_at=CAST(strftime('%s','now') AS integer)*1000
WHERE payment_method='STORE'
  AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING')
  AND smaregi_transaction_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM kitchen_test_orders t WHERE t.order_id=orders.id);
