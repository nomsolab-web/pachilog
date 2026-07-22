import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels, videos } from "../database/schema";
import {
  buildVideoMetadataBackfillUpdates,
  needsYoutubeMetadataBackfill,
  type BackfillVideoMetadata,
} from "../lib/video-metadata-backfill";
import { chunkArray, fetchVideoStats } from "../lib/youtube";

async function main() {
  const [videoRows, channelRows] = await Promise.all([db.select().from(videos), db.select().from(channels)]);
  const channelsById = new Map(channelRows.map((channel) => [channel.id, channel]));
  const backfillRows = videoRows
    .map((video) => ({
      videoId: video.videoId,
      title: video.title,
      durationSeconds: video.durationSeconds,
      liveBroadcastContent: video.liveBroadcastContent,
      channelCategory: channelsById.get(video.channelId)?.category,
    }))
    .filter(needsYoutubeMetadataBackfill);
  const fetchedMetadata: BackfillVideoMetadata[] = [];
  const failedVideoIds = new Set<string>();

  for (const batch of chunkArray(backfillRows, 50)) {
    try {
      const stats = await fetchVideoStats(batch.map((video) => video.videoId));
      fetchedMetadata.push(
        ...stats.map((stat) => ({
          videoId: stat.videoId,
          durationSeconds: stat.durationSeconds,
          liveBroadcastContent: stat.liveBroadcastContent,
        })),
      );
      const fetchedIds = new Set(stats.map((stat) => stat.videoId));
      for (const video of batch) {
        if (!fetchedIds.has(video.videoId)) failedVideoIds.add(video.videoId);
      }
    } catch (err) {
      for (const video of batch) failedVideoIds.add(video.videoId);
      console.error(`Failed to fetch YouTube metadata for batch ${batch[0]?.videoId}: ${(err as Error).message}`);
    }
  }

  const { updates, failedVideoIds: missingMetadataIds } = buildVideoMetadataBackfillUpdates(
    videoRows.map((video) => ({
      videoId: video.videoId,
      title: video.title,
      durationSeconds: video.durationSeconds,
      liveBroadcastContent: video.liveBroadcastContent,
      channelCategory: channelsById.get(video.channelId)?.category,
    })),
    fetchedMetadata,
  );
  for (const videoId of missingMetadataIds) failedVideoIds.add(videoId);
  let updated = 0;

  for (const update of updates) {
    await db
      .update(videos)
      .set({
        durationSeconds: update.durationSeconds,
        liveBroadcastContent: update.liveBroadcastContent,
        contentType: update.classification.contentType,
        contentTypeReason: update.classification.reason,
        contentTypeConfidence: update.classification.confidence,
        updatedAt: new Date(),
      })
      .where(eq(videos.videoId, update.videoId));
    updated += 1;
  }

  const quotaUnits = Math.ceil(backfillRows.length / 50);
  console.log(
    `YouTube metadata backfill: requested=${backfillRows.length}, fetched=${fetchedMetadata.length}, failed=${failedVideoIds.size}, estimatedQuotaUnits=${quotaUnits}`,
  );
  console.log(`Reclassified ${updated} videos.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
