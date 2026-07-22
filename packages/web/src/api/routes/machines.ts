import { Hono } from "hono";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../database";
import { channels, machineVotes, machines, videos, videoMachineLinks, videoSnapshots } from "../database/schema";
import { rateLimit } from "../middleware/rate-limit";
import { isVideoContentType, type VideoContentType } from "../lib/content-type";
import { selectComparisonSnapshots } from "../lib/ranking";

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
      .where(and(ne(videoMachineLinks.matchMethod, "manual_excluded"), eq(videos.contentType, "standard")));
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
      const comparison = selectComparisonSnapshots(
        (snapshotsByVideoId.get(row.videoId) ?? []).map((snapshot) => ({
          date: snapshot.date,
          subscriberCount: snapshot.viewCount,
        })),
        7,
      );
      if (comparison.latest && comparison.base) {
        stats.recentViews += Math.max(0, comparison.latest.subscriberCount - comparison.base.subscriberCount);
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
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    if (!machine) return c.json({ error: "not found" }, 404);

    const mentions = await db
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
        channelId: channels.id,
        channelName: channels.name,
        channelThumbnailUrl: channels.thumbnailUrl,
      })
      .from(videoMachineLinks)
      .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
      .innerJoin(channels, eq(videos.channelId, channels.id))
      .where(and(eq(videoMachineLinks.machineId, id), inArray(videos.contentType, contentTypes)))
      .orderBy(desc(videos.viewCount));

    const uniqueMentions = [...new Map(mentions.map((mention) => [mention.videoId, mention])).values()];
    const publishedDates = uniqueMentions.map((mention) => mention.publishedAt).filter((value): value is string => !!value).sort();

    return c.json(
      {
        machine,
        mentions: uniqueMentions,
        contentTypes,
        contentTypeCounts: countContentTypes(mentions),
        summary: {
          videoCount: uniqueMentions.length,
          totalViews: uniqueMentions.reduce((sum, mention) => sum + mention.viewCount, 0),
          periodStart: publishedDates[0] ?? null,
          periodEnd: publishedDates.at(-1) ?? null,
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
    const body = await c.req.json<{
      voteType: "want_to_play" | "wait_and_see" | "not_interested";
      voterFingerprint: string;
    }>();
    if (
      ["want_to_play", "wait_and_see", "not_interested"].includes(body.voteType) === false ||
      typeof body.voterFingerprint !== "string" ||
      body.voterFingerprint.length < 8 ||
      body.voterFingerprint.length > 256
    ) {
      return c.json({ error: "invalid body" }, 400);
    }
    await db
      .insert(machineVotes)
      .values({ machineId: id, voteType: body.voteType, voterFingerprint: body.voterFingerprint })
      .onConflictDoUpdate({
        target: [machineVotes.machineId, machineVotes.voterFingerprint],
        set: { voteType: body.voteType },
      });

    return c.json({ ok: true, status: "recorded" }, 200);
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

function countContentTypes(rows: { contentType: VideoContentType }[]) {
  const counts: Record<VideoContentType, number> = { standard: 0, short: 0, live: 0, promotion: 0, unknown: 0 };
  for (const row of rows) counts[row.contentType] += 1;
  return counts;
}
