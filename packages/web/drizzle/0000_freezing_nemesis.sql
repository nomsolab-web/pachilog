CREATE TABLE `channel_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`date` text NOT NULL,
	`subscriber_count` integer NOT NULL,
	`view_count` integer NOT NULL,
	`video_count` integer NOT NULL,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channel_date_idx` ON `channel_snapshots` (`channel_id`,`date`);--> statement-breakpoint
CREATE TABLE `channels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`youtube_channel_id` text,
	`handle` text,
	`name` text NOT NULL,
	`thumbnail_url` text,
	`category` text DEFAULT 'other' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `channels_youtube_channel_id_unique` ON `channels` (`youtube_channel_id`);--> statement-breakpoint
CREATE TABLE `machine_mentions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`channel_id` integer NOT NULL,
	`video_id` text NOT NULL,
	`video_title` text NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`published_at` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machine_video_idx` ON `machine_mentions` (`machine_id`,`video_id`);--> statement-breakpoint
CREATE TABLE `machine_video_judgments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`judgment_key` text NOT NULL,
	`machine_id` integer,
	`channel_id` integer,
	`video_id` text NOT NULL,
	`video_title` text NOT NULL,
	`channel_name` text,
	`published_at` text,
	`source` text DEFAULT 'gemini' NOT NULL,
	`status` text NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`reason` text,
	`matched_terms` text,
	`raw_response` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `machine_video_judgments_judgment_key_unique` ON `machine_video_judgments` (`judgment_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `machine_video_judgment_key_idx` ON `machine_video_judgments` (`judgment_key`);--> statement-breakpoint
CREATE TABLE `machine_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`machine_id` integer NOT NULL,
	`vote_type` text NOT NULL,
	`voter_fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`aliases` text,
	`exclude_terms` text,
	`type` text,
	`maker` text,
	`release_date` text,
	`thumbnail_url` text,
	`source_url` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `video_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`date` text NOT NULL,
	`view_count` integer NOT NULL,
	`like_count` integer NOT NULL,
	`comment_count` integer NOT NULL,
	`collected_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_date_idx` ON `video_snapshots` (`video_id`,`date`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`video_id` text NOT NULL,
	`channel_id` integer NOT NULL,
	`title` text NOT NULL,
	`thumbnail_url` text,
	`published_at` text,
	`view_count` integer DEFAULT 0 NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_video_id_unique` ON `videos` (`video_id`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel_id` integer NOT NULL,
	`vote_type` text NOT NULL,
	`voter_fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `weekly_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_of` text NOT NULL,
	`title` text NOT NULL,
	`body_markdown` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_summaries_week_of_unique` ON `weekly_summaries` (`week_of`);