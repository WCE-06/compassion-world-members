CREATE TABLE IF NOT EXISTS `admin_accounts` (
  `email` text PRIMARY KEY NOT NULL,
  `password_scheme` text NOT NULL,
  `password_salt` text NOT NULL,
  `password_hash` text NOT NULL,
  `password_changed_at` integer NOT NULL,
  `updated_by` text NOT NULL
);
