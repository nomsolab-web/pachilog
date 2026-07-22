ALTER TABLE `videos` ADD `content_type` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `content_type_reason` text;--> statement-breakpoint
ALTER TABLE `videos` ADD `content_type_confidence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `duration_seconds` integer;--> statement-breakpoint
ALTER TABLE `videos` ADD `live_broadcast_content` text;--> statement-breakpoint
DELETE FROM `machine_votes`
WHERE `id` NOT IN (
  SELECT MAX(`id`) FROM `machine_votes` GROUP BY `machine_id`, `voter_fingerprint`
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `machine_vote_fingerprint_idx` ON `machine_votes` (`machine_id`,`voter_fingerprint`);
