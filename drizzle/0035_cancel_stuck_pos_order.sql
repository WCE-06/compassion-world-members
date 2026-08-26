-- 2026-08-27: セルフレジ取消後にPAYMENT_RECONCILINGへ残った未決済注文を取消する。
UPDATE orders
SET status='CANCELLED', point_eligible=0, point_status='CANCELLED', updated_at=1787775864000
WHERE id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status IN ('WAITING_STORE_PAYMENT','PAYMENT_PROCESSING','PAYMENT_RECONCILING');

UPDATE order_payment_locks
SET status=CASE WHEN status='ACTIVE' THEN 'RELEASED' ELSE status END,
    released_at=COALESCE(released_at,1787775864000),
    release_reason=COALESCE(release_reason,'INCIDENT_ORDER_CANCELLED')
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status IN ('ACTIVE','RELEASED');

UPDATE order_fulfillments
SET status='CANCELLED', updated_at=1787775864000
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status='WAITING_PAYMENT';

UPDATE kitchen_units
SET status='CANCELLED', updated_at=1787775864000
WHERE order_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928'
  AND status='WAITING_PAYMENT';

UPDATE payment_point_events
SET eligible=0, updated_at=1787775864000
WHERE purpose='MOBILE_ORDER'
  AND source_id='ord_d7fee506-528a-45d3-b4ab-d8cccda07928';
