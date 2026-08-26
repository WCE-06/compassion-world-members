UPDATE orders SET status='CANCELLED', point_eligible=0, point_status='CANCELLED', updated_at=1787766770000 WHERE id='ord_782e7209-3ec5-486e-a851-d45851f6435e';
UPDATE orders SET status='REFUNDED', point_eligible=0, point_status='CANCELLED', updated_at=1787766770000 WHERE id='ord_8fd9741b-242f-448a-8c5f-f17d27433989';
UPDATE orders SET status='CANCELLED', point_eligible=0, point_status='CANCELLED', updated_at=1787766770000 WHERE id='ord_369021ce-55fa-4745-afdc-5626dedcbca1';
UPDATE order_fulfillments SET status='CANCELLED', updated_at=1787766770000 WHERE order_id IN ('ord_782e7209-3ec5-486e-a851-d45851f6435e','ord_8fd9741b-242f-448a-8c5f-f17d27433989','ord_369021ce-55fa-4745-afdc-5626dedcbca1');
UPDATE kitchen_units SET status='CANCELLED', updated_at=1787766770000 WHERE order_id IN ('ord_782e7209-3ec5-486e-a851-d45851f6435e','ord_8fd9741b-242f-448a-8c5f-f17d27433989','ord_369021ce-55fa-4745-afdc-5626dedcbca1');
UPDATE payment_point_events SET eligible=0, updated_at=1787766770000 WHERE purpose='MOBILE_ORDER' AND source_id IN ('ord_782e7209-3ec5-486e-a851-d45851f6435e','ord_8fd9741b-242f-448a-8c5f-f17d27433989','ord_369021ce-55fa-4745-afdc-5626dedcbca1');
