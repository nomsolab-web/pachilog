import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../database";
import { channels, videos, videoSnapshots } from "../database/schema";

const MODES = new Set(["previous", "7d"]);

export const videosRoute = new Hono().get("/trending", async (c) => {
  const requestedMode = c.req.query("mode") ?? "previous";
  const mode = MODES.has(requestedMode) ? requestedMode : "previous";
  const snapshotLimit = mode === "7d" ? 7 : 2;

  const videoRows = await db
    .select({
      id: videos.id,
      videoId: videos.videoId,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      publishedAt: videos.publishedAt,
      currentViewCount: videos.viewCount,
      channelId: videos.channelId,
      channelName: channels.name,
      channelThumbnailUrl: channels.thumbnailUrl,
    })
    .from(videos)
    .innerJoin(channels, eq(videos.channelId, channels.id))
    .orderBy(desc(videos.viewCount))
    .limit(300);

  const entries = await Promise.all(
    videoRows.map(async (video) => {
      const snapshots = await db
        .select()
        .from(videoSnapshots)
        .where(eq(videoSnapshots.videoId, video.videoId))
        .orderBy(desc(videoSnapshots.date), desc(videoSnapshots.collectedAt))
        .limit(snapshotLimit);

      const uniqueByDate = new Map<string, (typeof snapshots)[number]>();
      for (const snapshot of snapshots) {
        if (!uniqueByDate.has(snapshot.date)) uniqueByDate.set(snapshot.date, snapshot);
      }
      const periodSnapshots = [...uniqueByDate.values()].slice(0, snapshotLimit);
      const latest = periodSnapshots[0] ?? null;
      const base = periodSnapshots.at(-1) ?? null;
      const snapshotDays = periodSnapshots.length;
      const hasTrend = !!latest && !!base && snapshotDays > 1;
      const viewDelta = hasTrend ? latest.viewCount - base.viewCount : 0;
      const viewDeltaPct = hasTrend && base.viewCount > 0 ? (viewDelta / base.viewCount) * 100 : 0;

      return {
        ...video,
        latestDate: latest?.date ?? null,
        baseDate: hasTrend ? base?.date ?? null : null,
        snapshotDays,
        isProvisional: mode === "7d" && snapshotDays > 1 && snapshotDays < 7,
        hasTrend,
        viewDelta,
        viewDeltaPct: Number(viewDeltaPct.toFixed(2)),
      };
    }),
  );

  const ranked = entries.sort((a, b) => b.viewDelta - a.viewDelta || b.currentViewCount - a.currentViewCount);
  return c.json({ mode, videos: ranked }, 200);
});
