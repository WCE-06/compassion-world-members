ALTER TABLE `legacy_member_imports` ADD `line_display_name` text;--> statement-breakpoint
ALTER TABLE `legacy_member_imports` ADD `acquisition_source` text;--> statement-breakpoint
ALTER TABLE `legacy_member_imports` ADD `legacy_tags` text;--> statement-breakpoint
ALTER TABLE `members` ADD `line_display_name` text;--> statement-breakpoint
ALTER TABLE `members` ADD `acquisition_source` text;--> statement-breakpoint
ALTER TABLE `members` ADD `legacy_tags` text;