CREATE TABLE `video_machine_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`machine_id` integer NOT NULL,
	`match_confidence` integer DEFAULT 0 NOT NULL,
	`match_method` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`video_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_machine_link_idx` ON `video_machine_links` (`video_id`,`machine_id`);--> statement-breakpoint
ALTER TABLE `machines` ADD `series` text;--> statement-breakpoint
ALTER TABLE `machines` ADD `official_url` text;--> statement-breakpoint
ALTER TABLE `machines` ADD `updated_at` integer;--> statement-breakpoint
ALTER TABLE `videos` ADD `match_status` text DEFAULT 'pending' NOT NULL;