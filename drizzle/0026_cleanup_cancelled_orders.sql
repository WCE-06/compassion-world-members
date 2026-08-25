UPDATE `orders` SET `status`='CANCELLED' WHERE `status`='PAYMENT_FAILED' AND `stripe_payment_intent_id` IS NULL;
UPDATE `order_fulfillments` SET `status`='CANCELLED' WHERE `status`='WAITING_PAYMENT' AND `order_id` IN (SELECT `id` FROM `orders` WHERE `status`='CANCELLED');
