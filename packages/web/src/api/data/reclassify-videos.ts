import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels, videos } from "../database/schema";
import { VIDEO_CONTENT_TYPES, type VideoContentType } from "../lib/content-type";
import {
  buildVideoMetadataBackfillUpdates,
  filterUpdatesAfterMetadataFetch,
  selectVideoMetadataRows,
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
  const inputRows = videoRows.map((video) => ({
    videoId: video.videoId,
    title: video.title,
    durationSeconds: video.durationSeconds,
    liveBroadcastContent: video.liveBroadcastContent,
    channelCategory: channelsById.get(video.channelId)?.category,
  }));
  const metadataRows = selectVideoMetadataRows(inputRows, refreshMetadata);
  const fetchedMetadata: BackfillVideoMetadata[] = [];
  const failedVideoIds = new Set<string>();

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

  const { updates: plannedUpdates, failedVideoIds: missingMetadataIds } = buildVideoMetadataBackfillUpdates(inputRows, fetchedMetadata);
  for (const videoId of missingMetadataIds) failedVideoIds.add(videoId);
  const updates = filterUpdatesAfterMetadataFetch(plannedUpdates, fetchedMetadata, refreshMetadata);

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

  const transitionCounts: Record<string, number> = {};
  const transitionExamples: Record<string, typeof changes> = {};
  for (const change of changes) {
    const transition = `${change.before}${change.after}`;
    transitionCounts[transition] = (transitionCounts[transition] ?? 0) + 1;
    (transitionExamples[transition] ??= []).push(change);
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
      mode: refreshMetadata ? "refresh-all" : "incomplete-only",
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
      byTransition: transitionCounts,
      examplesByTransition: Object.fromEntries(
        Object.entries(transitionExamples).map(([transition, examples]) => [transition, examples.slice(0, 20)]),
      ),
      examples: changes.slice(0, 20),
    },
    updated: apply ? updates.length : 0,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log(
      "Dry-run only. Incomplete metadata is fetched by default; add --refresh-metadata to fetch all videos. Re-run with --apply to update rows.",
    );
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
