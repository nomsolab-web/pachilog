import { and, eq, inArray } from "drizzle-orm";
import { db as defaultDb } from "../database";
import { channels, videos, videoSnapshots } from "../database/schema";
import { fetchVideoStats } from "./youtube";
import { batchVideoIds, DEFAULT_VIDEO_TRACKING_DAYS, DEFAULT_VIDEO_TRACKING_MAX, selectTrackedVideoIds } from "./video-tracking";

export async function collectTrackedVideos(
  db: typeof defaultDb,
  activeChannels: (typeof channels.$inferSelect)[],
  date: string,
  discoveredVideoIds: ReadonlySet<string> = new Set(),
) {
  const activeChannelIds = new Set(activeChannels.map((channel) => channel.id));
  const trackingRows = await db.select({
    videoId: videos.videoId,
    channelId: videos.channelId,
    publishedAt: videos.publishedAt,
    updatedAt: videos.updatedAt,
  }).from(videos);
  const trackingDays = parsePositiveInt(process.env.VIDEO_TRACKING_DAYS, DEFAULT_VIDEO_TRACKING_DAYS);
  const trackingMax = parsePositiveInt(process.env.VIDEO_TRACKING_MAX, DEFAULT_VIDEO_TRACKING_MAX);
  const trackingIds = selectTrackedVideoIds(trackingRows, activeChannelIds, new Date(), trackingDays, trackingMax, discoveredVideoIds);
  const result = {
    trackingTargetCount: trackingIds.length,
    trackingSuccessCount: 0,
    trackingFailedCount: 0,
    trackingSnapshotInsertedCount: 0,
    youtubeVideoStatCalls: 0,
    errors: [] as string[],
  };

  for (const batch of batchVideoIds(trackingIds)) {
    let stats: Awaited<ReturnType<typeof fetchVideoStats>> = [];
    try {
      stats = await fetchVideoStats(batch);
      result.youtubeVideoStatCalls += 1;
    } catch (err) {
      result.trackingFailedCount += batch.length;
      result.errors.push(`video tracking batch failed: ${(err as Error).message}`);
      continue;
    }

    const statsMap = new Map(stats.map((stat) => [stat.videoId, stat]));
    result.trackingSuccessCount += stats.length;
    result.trackingFailedCount += batch.length - stats.length;
    const existingSnapshots = await db.select({ videoId: videoSnapshots.videoId }).from(videoSnapshots).where(
      and(inArray(videoSnapshots.videoId, batch), eq(videoSnapshots.date, date)),
    );
    const snapshotIds = new Set(existingSnapshots.map((snapshot) => snapshot.videoId));
    for (const videoId of batch) {
      const stat = statsMap.get(videoId);
      if (!stat) continue;
      await db.update(videos).set({
        viewCount: stat.viewCount,
        likeCount: stat.likeCount,
        commentCount: stat.commentCount,
        durationSeconds: stat.durationSeconds,
        liveBroadcastContent: stat.liveBroadcastContent,
        updatedAt: new Date(),
      }).where(eq(videos.videoId, videoId));
      if (!snapshotIds.has(videoId)) {
        await db.insert(videoSnapshots).values({
          videoId,
          date,
          viewCount: stat.viewCount,
          likeCount: stat.likeCount,
          commentCount: stat.commentCount,
        });
        result.trackingSnapshotInsertedCount += 1;
      }
    }
  }
  return result;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
