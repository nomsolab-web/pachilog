import { Hono } from "hono";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../database";
import { channels, machines, videos, videoMachineLinks, videoSnapshots } from "../database/schema";
import { isRankableVideoContentType, isVideoContentType, type VideoContentType } from "../lib/content-type";
import { clampLimit } from "../lib/pagination";
import { CONFIRMED_MATCH_STATUS, EXCLUDED_MACHINE_LINK_METHOD, selectConfirmedMachineVideos } from "../lib/machine-content";
import { calculateVideoTrend, decodeVideoRankingCursor, paginateVideoRanking, sortVideoRankingEntries } from "../lib/video-ranking";

const MODES = new Set(["previous", "7d"]);
const MAX_LIMIT = 100;

export const videosRoute = new Hono().get("/trending", async (c) => {
  const requestedMode = c.req.query("mode") ?? "previous";
  const mode = MODES.has(requestedMode) ? requestedMode : "previous";
  const period = mode === "7d" ? 7 : 1;
  const limit = clampLimit(c.req.query("limit"), 50, MAX_LIMIT);
  const cursor = decodeVideoRankingCursor(c.req.query("cursor"));
  const contentTypes = parseContentTypes(c.req.query("contentType") ?? "standard");
  const where = contentTypes.length === 1 ? eq(videos.contentType, contentTypes[0]) : inArray(videos.contentType, contentTypes);

  const videoRows = await db
    .select({
      id: videos.id,
      videoId: videos.videoId,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      publishedAt: videos.publishedAt,
      currentViewCount: videos.viewCount,
      contentType: videos.contentType,
      durationSeconds: videos.durationSeconds,
      liveBroadcastContent: videos.liveBroadcastContent,
      channelId: videos.channelId,
      channelName: channels.name,
      channelThumbnailUrl: channels.thumbnailUrl,
    })
    .from(videos)
    .innerJoin(channels, eq(videos.channelId, channels.id))
    .where(where)
    .orderBy(desc(videos.viewCount));

  const videoIds = videoRows.map((video) => video.videoId);
  const machineTagRows = videoIds.length > 0
    ? await db
        .select({ videoId: videoMachineLinks.videoId, machineId: machines.id, machineName: machines.name, matchStatus: videos.matchStatus, matchMethod: videoMachineLinks.matchMethod, contentType: videos.contentType })
        .from(videoMachineLinks)
        .innerJoin(machines, eq(videoMachineLinks.machineId, machines.id))
        .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
        .where(and(inArray(videoMachineLinks.videoId, videoIds), eq(videos.matchStatus, CONFIRMED_MATCH_STATUS), ne(videoMachineLinks.matchMethod, EXCLUDED_MACHINE_LINK_METHOD)))
    : [];
  const machineTagsByVideoId = new Map<string, { id: number; name: string }[]>();
  for (const row of selectConfirmedMachineVideos(machineTagRows)) {
    const tags = machineTagsByVideoId.get(row.videoId) ?? [];
    if (!tags.some((tag) => tag.id === row.machineId)) tags.push({ id: row.machineId, name: row.machineName });
    machineTagsByVideoId.set(row.videoId, tags);
  }
  const snapshotRows =
    videoIds.length > 0
      ? await db
          .select()
          .from(videoSnapshots)
          .where(inArray(videoSnapshots.videoId, videoIds))
          .orderBy(desc(videoSnapshots.date), desc(videoSnapshots.collectedAt))
      : [];
  const snapshotsByVideoId = new Map<string, typeof snapshotRows>();
  for (const snapshot of snapshotRows) {
    const list = snapshotsByVideoId.get(snapshot.videoId) ?? [];
    list.push(snapshot);
    snapshotsByVideoId.set(snapshot.videoId, list);
  }

  const entries = videoRows.map((video) => {
      const snapshots = snapshotsByVideoId.get(video.videoId) ?? [];
      return {
        ...video,
        machineTags: machineTagsByVideoId.get(video.videoId) ?? [],
        ...calculateVideoTrend(snapshots, period),
      };
    });

  const ranked = sortVideoRankingEntries(entries.filter((entry) => entry.viewDelta > 0 && isRankableVideoContentType(entry.contentType)));
  const page = paginateVideoRanking(ranked, limit, cursor);
  const counts = await contentTypeCounts();
  return c.json(
    {
      mode,
      period,
      contentTypes,
      limit,
      nextCursor: page.nextCursor,
      counts,
      videos: page.page,
      queryPlan: { videos: 1, snapshots: 1, contentTypeCounts: 1 },
    },
    200,
  );
});

function parseContentTypes(value: string): VideoContentType[] {
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(isVideoContentType);
  return parsed.length > 0 ? parsed : ["standard"];
}

async function contentTypeCounts() {
  const rows = await db.select({ contentType: videos.contentType }).from(videos);
  const counts: Record<VideoContentType, number> = {
    standard: 0,
    short: 0,
    live: 0,
    promotion: 0,
    unknown: 0,
  };
  for (const row of rows) counts[row.contentType] += 1;
  return counts;
}
