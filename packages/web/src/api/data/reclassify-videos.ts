import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels, videos } from "../database/schema";
import { VIDEO_CONTENT_TYPES, type VideoContentType } from "../lib/content-type";
import {
  buildVideoMetadataBackfillUpdates,
  needsYoutubeMetadataBackfill,
  type BackfillVideoMetadata,
} from "../lib/video-metadata-backfill";
import { chunkArray, fetchVideoStats } from "../lib/youtube";

const apply = process.argv.includes("--apply");
const refreshMetadata = process.argv.includes("--refresh-metadata");
const allowWrite = process.env.RECLASSIFY_VIDEOS_ALLOW_WRITE === "1";

async function main() {
  if (apply && !allowWrite) {
    throw new Error("Refusing to write: set RECLASSIFY_VIDEOS_ALLOW_WRITE=1 after reviewing a dry-run result");
  }

  const [videoRows, channelRows] = await Promise.all([db.select().from(videos), db.select().from(channels)]);
  const channelsById = new Map(channelRows.map((channel) => [channel.id, channel]));
  const metadataRows = videoRows
    .map((video) => ({
      videoId: video.videoId,
      title: video.title,
      durationSeconds: video.durationSeconds,
      liveBroadcastContent: video.liveBroadcastContent,
      channelCategory: channelsById.get(video.channelId)?.category,
    }))
    .filter((video) => refreshMetadata || needsYoutubeMetadataBackfill(video));
  const fetchedMetadata: BackfillVideoMetadata[] = [];
  const failedVideoIds = new Set<string>();

  if (refreshMetadata) {
    for (const batch of chunkArray(metadataRows, 50)) {
      try {
        const stats = await fetchVideoStats(batch.map((video) => video.videoId));
        fetchedMetadata.push(
          ...stats.map((stat) => ({
            videoId: stat.videoId,
            durationSeconds: stat.durationSeconds,
            liveBroadcastContent: stat.liveBroadcastContent,
            liveStreamingDetails: stat.liveStreamingDetails,
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
  }

  const inputRows = videoRows.map((video) => ({
    videoId: video.videoId,
    title: video.title,
    durationSeconds: video.durationSeconds,
    liveBroadcastContent: video.liveBroadcastContent,
    channelCategory: channelsById.get(video.channelId)?.category,
  }));
  const { updates, failedVideoIds: missingMetadataIds } = buildVideoMetadataBackfillUpdates(inputRows, fetchedMetadata);
  for (const videoId of missingMetadataIds) failedVideoIds.add(videoId);

  const currentByVideoId = new Map(videoRows.map((video) => [video.videoId, video]));
  const beforeCounts = countTypes(videoRows.map((video) => video.contentType));
  const afterTypes = new Map(videoRows.map((video) => [video.videoId, video.contentType]));
  const changes = [];

  for (const update of updates) {
    const current = currentByVideoId.get(update.videoId);
    if (!current) continue;
    afterTypes.set(update.videoId, update.classification.contentType);
    if (current.contentType !== update.classification.contentType) {
      changes.push({
        videoId: update.videoId,
        title: current.title,
        before: current.contentType,
        after: update.classification.contentType,
        reason: update.classification.reason,
      });
    }
  }

  if (apply) {
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
    }
  }

  const quotaUnits = Math.ceil(metadataRows.length / 50);
  const summary = {
    mode: apply ? "apply" : "dry-run",
    videosScanned: videoRows.length,
    metadataBackfill: {
      enabled: refreshMetadata,
      requested: metadataRows.length,
      fetched: fetchedMetadata.length,
      failed: failedVideoIds.size,
      estimatedQuotaUnits: quotaUnits,
    },
    missingFields: {
      durationSeconds: videoRows.filter((video) => video.durationSeconds === null).length,
      liveBroadcastContent: videoRows.filter((video) => video.liveBroadcastContent === null).length,
      liveStreamingDetails: "not persisted in current schema; use --refresh-metadata to include it during this run",
      shortsVerification: "YouTube videos.list has no direct Shorts flag; hashtag/duration remain fallback signals",
    },
    beforeCounts,
    afterCounts: countTypes([...afterTypes.values()]),
    changes: {
      total: changes.length,
      examples: changes.slice(0, 20),
    },
    updated: apply ? updates.length : 0,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to update rows. Add --refresh-metadata to call YouTube videos.list.");
  }
}

function countTypes(values: VideoContentType[]) {
  const counts: Record<VideoContentType, number> = {
    standard: 0,
    short: 0,
    live: 0,
    promotion: 0,
    unknown: 0,
  };
  for (const value of values) {
    if ((VIDEO_CONTENT_TYPES as readonly string[]).includes(value)) counts[value] += 1;
  }
  return counts;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
