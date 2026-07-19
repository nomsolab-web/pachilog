CREATE TABLE `ambiguous_video_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`candidate_machine_id` integer NOT NULL,
	`matched_terms` text NOT NULL,
	`confidence` integer DEFAULT 50 NOT NULL,
	`reason` text,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`video_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ambiguous_video_link_idx` ON `ambiguous_video_links` (`video_id`,`candidate_machine_id`);--> statement-breakpoint
CREATE INDEX `ambiguous_video_id_idx` ON `ambiguous_video_links` (`video_id`);--> statement-breakpoint
CREATE INDEX `ambiguous_machine_id_idx` ON `ambiguous_video_links` (`candidate_machine_id`);--> statement-breakpoint
CREATE INDEX `ambiguous_review_status_idx` ON `ambiguous_video_links` (`review_status`);