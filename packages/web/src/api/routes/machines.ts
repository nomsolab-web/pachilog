import { Hono } from "hono";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { channels, machineVotes, machines, videos, videoMachineLinks, videoSnapshots } from "../database/schema";
import { rateLimit } from "../middleware/rate-limit";
import { isRankableVideoContentType, isVideoContentType, type VideoContentType } from "../lib/content-type";
import { countMachineContentTypes } from "../lib/machine-content";
import { isMachineVoteType, isPlainRecord, machineVoteStatus, validateVoterFingerprint } from "../lib/machine-votes";
import { calculateVideoTrend, sortVideoRankingEntries } from "../lib/video-ranking";

export const machinesRoute = new Hono()
  .get("/", async (c) => {
    const list = await db.select().from(machines);
    const rows = await db
      .select({
        machineId: videoMachineLinks.machineId,
        videoId: videos.videoId,
        viewCount: videos.viewCount,
        contentType: videos.contentType,
      })
      .from(videoMachineLinks)
      .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
      .where(and(eq(videos.matchStatus, "matched"), eq(videos.contentType, "standard")));
    const videoIds = [...new Set(rows.map((row) => row.videoId))];
    const snapshots =
      videoIds.length > 0
        ? await db.select().from(videoSnapshots).where(inArray(videoSnapshots.videoId, videoIds)).orderBy(desc(videoSnapshots.date))
        : [];
    const snapshotsByVideoId = groupSnapshotsByVideoId(snapshots);
    const statsByMachine = new Map<number, { totalViews: number; videoCount: number; recentViews: number; recentVideoCount: number }>();

    for (const row of rows) {
      const stats = statsByMachine.get(row.machineId) ?? { totalViews: 0, videoCount: 0, recentViews: 0, recentVideoCount: 0 };
      stats.totalViews += row.viewCount;
      stats.videoCount += 1;
      const trend = calculateVideoTrend(snapshotsByVideoId.get(row.videoId) ?? [], 7);
      if (trend.hasTrend) {
        stats.recentViews += Math.max(0, trend.viewDelta);
        stats.recentVideoCount += 1;
      }
      statsByMachine.set(row.machineId, stats);
    }

    const withBuzz = list.map((machine) => ({ ...machine, ...(statsByMachine.get(machine.id) ?? { totalViews: 0, videoCount: 0, recentViews: 0, recentVideoCount: 0 }) }));

    // Sort by momentum (recentViews) descending
    withBuzz.sort((a, b) => b.recentViews - a.recentViews || b.totalViews - a.totalViews);
    return c.json({ machines: withBuzz }, 200);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const contentTypes = parseContentTypes(c.req.query("contentType") ?? "standard");
    const sort = parseSort(c.req.query("sort"));
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    if (!machine) return c.json({ error: "not found" }, 404);

    const linkedVideos = await db
      .select({
        id: videos.id,
        videoId: videos.videoId,
        videoTitle: videos.title,
        viewCount: videos.viewCount,
        likeCount: videos.likeCount,
        commentCount: videos.commentCount,
        publishedAt: videos.publishedAt,
        updatedAt: videos.updatedAt,
        contentType: videos.contentType,
        matchMethod: videoMachineLinks.matchMethod,
        matchStatus: videos.matchStatus,
        channelId: channels.id,
        channelName: channels.name,
        channelThumbnailUrl: channels.thumbnailUrl,
      })
      .from(videoMachineLinks)
      .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
      .innerJoin(channels, eq(videos.channelId, channels.id))
      .where(and(eq(videoMachineLinks.machineId, id), eq(videos.matchStatus, "matched")))
      .orderBy(desc(videos.updatedAt));

    const mentions = linkedVideos.filter((video) => contentTypes.includes(video.contentType));
    const uniqueMentions = [...new Map(mentions.map((mention) => [mention.videoId, mention])).values()];
    const allConfirmedVideos = [...new Map(linkedVideos.map((mention) => [mention.videoId, mention])).values()];
    const videoIds = allConfirmedVideos.map((video) => video.videoId);
    const snapshots = videoIds.length > 0
      ? await db.select().from(videoSnapshots).where(inArray(videoSnapshots.videoId, videoIds)).orderBy(desc(videoSnapshots.date))
      : [];
    const snapshotsByVideoId = groupSnapshotsByVideoId(snapshots);
    const machineTags = videoIds.length > 0
      ? await db
          .select({ videoId: videoMachineLinks.videoId, machineId: machines.id, machineName: machines.name })
          .from(videoMachineLinks)
          .innerJoin(machines, eq(videoMachineLinks.machineId, machines.id))
          .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
          .where(and(inArray(videoMachineLinks.videoId, videoIds), eq(videos.matchStatus, "matched")))
      : [];
    const machineTagsByVideoId = new Map<string, { id: number; name: string }[]>();
    for (const tag of machineTags) {
      const tags = machineTagsByVideoId.get(tag.videoId) ?? [];
      if (!tags.some((item) => item.id === tag.machineId)) tags.push({ id: tag.machineId, name: tag.machineName });
      machineTagsByVideoId.set(tag.videoId, tags);
    }
    const rankedMentions = uniqueMentions.map((video) => ({
      ...video,
      machineTags: machineTagsByVideoId.get(video.videoId) ?? [],
      ...calculateVideoTrend(snapshotsByVideoId.get(video.videoId) ?? [], 7),
      currentViewCount: video.viewCount,
    }));
    const videosForDisplay = sortMachineVideos(rankedMentions, sort);
    const publishedDates = allConfirmedVideos.map((mention) => mention.publishedAt).filter((value): value is string => !!value).sort();
    const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentVideos = allConfirmedVideos.filter((video) => video.publishedAt && Date.parse(video.publishedAt) >= recentCutoff);
    const recentViews = allConfirmedVideos.reduce((sum, video) => {
      const trend = calculateVideoTrend(snapshotsByVideoId.get(video.videoId) ?? [], 7);
      return sum + (trend.hasTrend ? Math.max(0, trend.viewDelta) : 0);
    }, 0);
    const updatedDates = allConfirmedVideos.map((video) => video.updatedAt).filter(Boolean).sort((a, b) => b.getTime() - a.getTime());
    const lastUpdatedAt = updatedDates[0] ?? null;

    return c.json(
      {
        machine,
        mentions: videosForDisplay,
        contentTypes,
        contentTypeCounts: countMachineContentTypes(allConfirmedVideos),
        summary: {
          videoCount: allConfirmedVideos.length,
          rankingVideoCount: allConfirmedVideos.filter((video) => ["standard", "short", "live"].includes(video.contentType)).length,
          totalViews: allConfirmedVideos.reduce((sum, mention) => sum + mention.viewCount, 0),
          recentVideoCount: recentVideos.length,
          recentViews,
          lastUpdatedAt,
          periodStart: publishedDates[0] ?? null,
          periodEnd: publishedDates[publishedDates.length - 1] ?? null,
        },
      },
      200,
    );
  })
  .get("/:id/votes", async (c) => {
    const id = Number(c.req.param("id"));
    const all = await db.select().from(machineVotes).where(eq(machineVotes.machineId, id));
    const counts = { want_to_play: 0, wait_and_see: 0, not_interested: 0 };
    for (const v of all) counts[v.voteType as keyof typeof counts] += 1;
    const total = counts.want_to_play + counts.wait_and_see + counts.not_interested;
    return c.json({ counts, total }, 200);
  })
  .post("/:id/votes", rateLimit({ limit: 5, windowMs: 60_000 }), async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id < 1) return c.json({ error: "invalid machineId" }, 400);
    const [machine] = await db.select({ id: machines.id }).from(machines).where(eq(machines.id, id));
    if (!machine) return c.json({ error: "machine not found" }, 404);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    if (!isPlainRecord(body)) {
      return c.json({ error: "invalid body" }, 400);
    }
    if (!isMachineVoteType(body.voteType) || !validateVoterFingerprint(body.voterFingerprint)) {
      return c.json({ error: "invalid body" }, 400);
    }
    const inserted = await db
      .insert(machineVotes)
      .values({ machineId: id, voteType: body.voteType, voterFingerprint: body.voterFingerprint })
      .onConflictDoNothing()
      .returning({ id: machineVotes.id });

    if (inserted.length > 0) {
      return c.json({ ok: true, status: "recorded" }, 201);
    }

    const [existingVote] = await db
      .select({ voteType: machineVotes.voteType })
      .from(machineVotes)
      .where(and(eq(machineVotes.machineId, id), eq(machineVotes.voterFingerprint, body.voterFingerprint)));
    const status = machineVoteStatus(existingVote?.voteType ?? null, body.voteType);
    if (status === "updated") {
      await db
        .update(machineVotes)
        .set({ voteType: body.voteType })
        .where(and(eq(machineVotes.machineId, id), eq(machineVotes.voterFingerprint, body.voterFingerprint)));
    }

    return c.json({ ok: true, status }, 200);
  });

function groupSnapshotsByVideoId(rows: (typeof videoSnapshots.$inferSelect)[]) {
  const grouped = new Map<string, (typeof videoSnapshots.$inferSelect)[]>();
  for (const row of rows) {
    const list = grouped.get(row.videoId) ?? [];
    list.push(row);
    grouped.set(row.videoId, list);
  }
  return grouped;
}

function parseContentTypes(value: string): VideoContentType[] {
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(isVideoContentType);
  return parsed.length > 0 ? parsed : ["standard"];
}

type MachineSort = "rising" | "newest" | "views";

function parseSort(value: string | undefined): MachineSort {
  return value === "newest" || value === "views" ? value : "rising";
}

function sortMachineVideos<T extends {
  videoId: string;
  currentViewCount: number;
  viewDelta: number;
  contentType: VideoContentType;
  publishedAt: string | null;
}>(videos: readonly T[], sort: MachineSort) {
  if (sort === "rising") return sortVideoRankingEntries(videos.filter((video) => video.viewDelta > 0 && isRankableVideoContentType(video.contentType)));
  return [...videos].sort((a, b) => {
    if (sort === "views") return b.currentViewCount - a.currentViewCount || compareDates(b.publishedAt, a.publishedAt);
    return compareDates(b.publishedAt, a.publishedAt) || b.currentViewCount - a.currentViewCount;
  });
}

function compareDates(a: string | null, b: string | null) {
  return Date.parse(a ?? "") - Date.parse(b ?? "");
}
