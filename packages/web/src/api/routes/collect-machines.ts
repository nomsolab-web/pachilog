import { Hono } from "hono";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../database";
import { channels, machineMentions, machines } from "../database/schema";
import {
  fetchRecentVideos,
  fetchUploadsPlaylistId,
  fetchVideoStats,
  isSuccessfulCollectionRate,
  mapWithConcurrency,
} from "../lib/youtube";

export const collectMachines = new Hono().post("/run", async (c) => {
  const secret = c.req.header("x-collect-secret");
  if (!secret || secret !== process.env.COLLECT_SECRET_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const results = {
    channelsRequested: 0,
    channelsScanned: 0,
    skippedNoPlaylist: 0,
    skippedNoVideos: 0,
    mentionsUpserted: 0,
    failedChannels: 0,
    errors: [] as string[],
  };

  const machineList = await db.select().from(machines);
  if (machineList.length === 0) {
    return c.json({ ...results, note: "no machines registered yet" }, 200);
  }

  const activeChannels = await db
    .select()
    .from(channels)
    .where(and(eq(channels.active, true), isNotNull(channels.youtubeChannelId)));
  results.channelsRequested = activeChannels.length;

  await mapWithConcurrency(activeChannels, 5, async (ch) => {
    try {
      const playlistId = await fetchUploadsPlaylistId(ch.youtubeChannelId as string);
      if (!playlistId) {
        results.skippedNoPlaylist += 1;
        return;
      }

      const videos = await fetchRecentVideos(playlistId, 25);
      if (videos.length === 0) {
        results.skippedNoVideos += 1;
        return;
      }

      // find which recent videos mention a tracked machine name in their title
      const matches = videos
        .map((v) => ({ video: v, machine: machineList.find((m) => v.title.includes(m.name)) }))
        .filter((x) => x.machine);

      if (matches.length === 0) {
        results.channelsScanned += 1;
        return;
      }

      const stats = await fetchVideoStats(matches.map((x) => x.video.videoId));
      const statsMap = new Map(stats.map((s) => [s.videoId, s]));

      for (const { video, machine } of matches) {
        const stat = statsMap.get(video.videoId);
        if (!stat || !machine) continue;

        const existing = await db
          .select()
          .from(machineMentions)
          .where(and(eq(machineMentions.machineId, machine.id), eq(machineMentions.videoId, video.videoId)));

        if (existing.length > 0) {
          await db
            .update(machineMentions)
            .set({
              viewCount: stat.viewCount,
              likeCount: stat.likeCount,
              commentCount: stat.commentCount,
              updatedAt: new Date(),
            })
            .where(eq(machineMentions.id, existing[0].id));
        } else {
          await db.insert(machineMentions).values({
            machineId: machine.id,
            channelId: ch.id,
            videoId: video.videoId,
            videoTitle: video.title,
            viewCount: stat.viewCount,
            likeCount: stat.likeCount,
            commentCount: stat.commentCount,
            publishedAt: video.publishedAt,
          });
        }
        results.mentionsUpserted += 1;
      }

      results.channelsScanned += 1;
    } catch (err) {
      results.failedChannels += 1;
      results.errors.push(`${ch.name}: ${(err as Error).message}`);
    }
  });

  const ok = isSuccessfulCollectionRate(results.channelsRequested - results.failedChannels, results.channelsRequested);
  return c.json(results, ok ? 200 : 502);
});
