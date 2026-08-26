CREATE TABLE IF NOT EXISTS `notification_popup_deliveries` (
  `notification_id` text PRIMARY KEY NOT NULL,
  `member_id` text NOT NULL,
  `delivered_at` integer NOT NULL,
  FOREIGN KEY (`notification_id`) REFERENCES `member_notifications`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS `notification_popup_member_idx` ON `notification_popup_deliveries` (`member_id`,`delivered_at`);

-- 公開前から存在する入店通知を、新着として再表示しない。
INSERT OR IGNORE INTO `notification_popup_deliveries` (`notification_id`,`member_id`,`delivered_at`)
SELECT `id`,`member_id`,CAST(strftime('%s','now') AS INTEGER) * 1000
FROM `member_notifications`
WHERE `event_type` = 'ENTRY_THANK_YOU';
