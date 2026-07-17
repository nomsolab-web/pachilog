import { Hono } from "hono";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../database";
import { channels, machineMentions, machines, videos as videosTable, videoSnapshots } from "../database/schema";
import { dateStringInTimeZone } from "../lib/date";
import {
  fetchRecentVideos,
  fetchUploadsPlaylistId,
  fetchVideoStats,
  isSuccessfulCollectionRate,
  mapWithConcurrency,
} from "../lib/youtube";
import { findMachineMatches } from "../lib/machine-match";
import { buildAiCandidates, runAiMachineJudgments, type AiCandidate } from "../lib/machine-ai";

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
    videosUpserted: 0,
    videoSnapshotsInserted: 0,
    videoSnapshotsSkippedExisting: 0,
    youtubeVideoStatCalls: 0,
    failedChannels: 0,
    ai: null as Awaited<ReturnType<typeof runAiMachineJudgments>> | null,
    errors: [] as string[],
  };
  const aiCandidates: AiCandidate[] = [];
  const date = dateStringInTimeZone();

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

      const stats = await fetchVideoStats([...new Set(videos.map((video) => video.videoId))]);
      results.youtubeVideoStatCalls += Math.ceil(new Set(videos.map((video) => video.videoId)).size / 50);
      const statsMap = new Map(stats.map((s) => [s.videoId, s]));
      for (const video of videos) {
        const stat = statsMap.get(video.videoId);
        if (!stat) continue;

        const existingVideo = await db.select().from(videosTable).where(eq(videosTable.videoId, video.videoId));
        if (existingVideo.length > 0) {
          await db
            .update(videosTable)
            .set({
              channelId: ch.id,
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              publishedAt: video.publishedAt,
              viewCount: stat.viewCount,
              likeCount: stat.likeCount,
              commentCount: stat.commentCount,
              updatedAt: new Date(),
            })
            .where(eq(videosTable.id, existingVideo[0].id));
        } else {
          await db.insert(videosTable).values({
            videoId: video.videoId,
            channelId: ch.id,
            title: video.title,
            thumbnailUrl: video.thumbnailUrl,
            publishedAt: video.publishedAt,
            viewCount: stat.viewCount,
            likeCount: stat.likeCount,
            commentCount: stat.commentCount,
          });
        }
        results.videosUpserted += 1;

        const existingSnapshot = await db
          .select()
          .from(videoSnapshots)
          .where(and(eq(videoSnapshots.videoId, video.videoId), eq(videoSnapshots.date, date)));
        if (existingSnapshot.length > 0) {
          results.videoSnapshotsSkippedExisting += 1;
        } else {
          await db.insert(videoSnapshots).values({
            videoId: video.videoId,
            date,
            viewCount: stat.viewCount,
            likeCount: stat.likeCount,
            commentCount: stat.commentCount,
          });
          results.videoSnapshotsInserted += 1;
        }
      }

      const matches = videos.flatMap((video) =>
        findMachineMatches(video.title, machineList).map((machine) => ({ video, machine })),
      );
      const matchedVideoIds = new Set(matches.map((match) => match.video.videoId));
      aiCandidates.push(...buildAiCandidates(videos.filter((video) => !matchedVideoIds.has(video.videoId)), ch, machineList));

      if (matches.length === 0) {
        results.channelsScanned += 1;
        return;
      }

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

  results.ai = await runAiMachineJudgments(aiCandidates);
  console.log("Machine AI judgment summary", {
    skipped: results.ai.skipped,
    callsUsed: results.ai.callsUsed,
    candidates: results.ai.candidates,
    autoLinked: results.ai.autoLinked,
    pending: results.ai.pending,
    rejected: results.ai.rejected,
    failed: results.ai.failed,
  });

  const ok = isSuccessfulCollectionRate(results.channelsRequested - results.failedChannels, results.channelsRequested);
  return c.json(results, ok ? 200 : 502);
});
