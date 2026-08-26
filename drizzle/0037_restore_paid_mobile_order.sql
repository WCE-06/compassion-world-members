-- 2026-08-27 incident recovery:
-- Smaregi transaction 589 was completed, but the Android UI timed out before the
-- idempotent payment notification reached the member/kitchen service.
UPDATE orders
SET status='PAID',
    smaregi_transaction_id='589',
    point_eligible=1,
    point_status='PENDING',
    updated_at=1787785939000
WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status='CANCELLED'
  AND smaregi_transaction_id IS NULL;

UPDATE order_fulfillments
SET status='ACCEPTED', updated_at=1787785939000
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status='CANCELLED'
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
      AND status='PAID' AND smaregi_transaction_id='589'
  );

UPDATE kitchen_units
SET status='ACCEPTED', updated_at=1787785939000
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status='CANCELLED'
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
      AND status='PAID' AND smaregi_transaction_id='589'
  );

UPDATE order_payment_locks
SET status='CONSUMED', released_at=1787785939000,
    release_reason='INCIDENT_PAYMENT_CONFIRMED'
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status IN ('ACTIVE','RELEASED','EXPIRED');

INSERT OR IGNORE INTO order_payment_events
  (id,request_id,order_id,payment_id,lock_id,device_id,paid_at,created_at)
SELECT
  'evt_incident_20260827_589',
  'incident:ord_d7fee506-528a-45d3-b4ab-d8cccda07928:589',
  'ord_d7fee506-528a-45d3-b4ab-d8cccda07928',
  '589',
  (SELECT id FROM order_payment_locks
   WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
   ORDER BY locked_at DESC LIMIT 1),
  (SELECT device_id FROM order_payment_locks
   WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
   ORDER BY locked_at DESC LIMIT 1),
  1787785939000,
  1787785939000
WHERE EXISTS (
  SELECT 1 FROM orders
  WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
    AND status='PAID' AND smaregi_transaction_id='589'
);

UPDATE payment_point_events
SET eligible=1, updated_at=1787785939000
WHERE purpose='MOBILE_ORDER'
  AND source_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND EXISTS (
    SELECT 1 FROM orders
    WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
      AND status='PAID' AND smaregi_transaction_id='589'
  );
