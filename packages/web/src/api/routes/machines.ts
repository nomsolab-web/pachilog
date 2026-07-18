import { Hono } from "hono";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "../database";
import { channels, machineMentions, machineVotes, machines, videoSnapshots, videoMachineLinks, videos as videosTable } from "../database/schema";
import { rateLimit } from "../middleware/rate-limit";

export const machinesRoute = new Hono()
  .get("/", async (c) => {
    const list = await db.select().from(machines);

    const withBuzz = await Promise.all(
      list.map(async (m) => {
        const mentions = await db.select().from(machineMentions).where(eq(machineMentions.machineId, m.id));
        const totalViews = mentions.reduce((sum, x) => sum + x.viewCount, 0);
        const videoCount = mentions.length;

        // Calculate momentum (views gained in the last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD

        let recentViews = 0;
        let recentVideoCount = 0;

        for (const mention of mentions) {
          // Find the snapshot of this video from 7 days ago
          const [snapshot] = await db
            .select()
            .from(videoSnapshots)
            .where(
              and(
                eq(videoSnapshots.videoId, mention.videoId),
                eq(videoSnapshots.date, sevenDaysAgoStr)
              )
            )
            .limit(1);

          let baseViews = 0;
          if (snapshot) {
            baseViews = snapshot.viewCount;
            recentViews += Math.max(0, mention.viewCount - baseViews);
            recentVideoCount += 1;
          } else {
            // If no snapshot exists exactly 7 days ago, we search for the oldest snapshot within the 7-day window.
            const oldestSnapshot = await db
              .select()
              .from(videoSnapshots)
              .where(
                and(
                  eq(videoSnapshots.videoId, mention.videoId),
                  gte(videoSnapshots.date, sevenDaysAgoStr)
                )
              )
              .orderBy(asc(videoSnapshots.date))
              .limit(1);
            if (oldestSnapshot[0]) {
              baseViews = oldestSnapshot[0].viewCount;
              recentViews += Math.max(0, mention.viewCount - baseViews);
              recentVideoCount += 1;
            } else {
              // If absolutely no snapshots exist, we assume all views are recent
              recentViews += mention.viewCount;
              recentVideoCount += 1;
            }
          }
        }

        return { ...m, totalViews, videoCount, recentViews, recentVideoCount };
      }),
    );

    // Sort by momentum (recentViews) descending
    withBuzz.sort((a, b) => b.recentViews - a.recentViews || b.totalViews - a.totalViews);
    return c.json({ machines: withBuzz }, 200);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    if (!machine) return c.json({ error: "not found" }, 404);

    const mentions = await db
      .select({
        id: machineMentions.id,
        videoId: machineMentions.videoId,
        videoTitle: machineMentions.videoTitle,
        viewCount: machineMentions.viewCount,
        likeCount: machineMentions.likeCount,
        commentCount: machineMentions.commentCount,
        publishedAt: machineMentions.publishedAt,
        updatedAt: machineMentions.updatedAt,
        channelId: channels.id,
        channelName: channels.name,
        channelThumbnailUrl: channels.thumbnailUrl,
      })
      .from(machineMentions)
      .innerJoin(channels, eq(machineMentions.channelId, channels.id))
      .where(eq(machineMentions.machineId, id))
      .orderBy(desc(machineMentions.viewCount));

    const uniqueMentions = [...new Map(mentions.map((mention) => [mention.videoId, mention])).values()];
    const oldest = await db
      .select({ publishedAt: machineMentions.publishedAt })
      .from(machineMentions)
      .where(eq(machineMentions.machineId, id))
      .orderBy(asc(machineMentions.publishedAt))
      .limit(1);
    const latest = await db
      .select({ publishedAt: machineMentions.publishedAt })
      .from(machineMentions)
      .where(eq(machineMentions.machineId, id))
      .orderBy(desc(machineMentions.publishedAt))
      .limit(1);

    return c.json(
      {
        machine,
        mentions: uniqueMentions,
        summary: {
          videoCount: uniqueMentions.length,
          totalViews: uniqueMentions.reduce((sum, mention) => sum + mention.viewCount, 0),
          periodStart: oldest[0]?.publishedAt ?? null,
          periodEnd: latest[0]?.publishedAt ?? null,
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
    const body = await c.req.json<{
      voteType: "want_to_play" | "wait_and_see" | "not_interested";
      voterFingerprint: string;
    }>();
    if (["want_to_play", "wait_and_see", "not_interested"].includes(body.voteType) === false || !body.voterFingerprint) {
      return c.json({ error: "invalid body" }, 400);
    }

    const existing = await db
      .select()
      .from(machineVotes)
      .where(and(eq(machineVotes.machineId, id), eq(machineVotes.voterFingerprint, body.voterFingerprint)));

    if (existing.length > 0) {
      await db
        .update(machineVotes)
        .set({ voteType: body.voteType })
        .where(and(eq(machineVotes.machineId, id), eq(machineVotes.voterFingerprint, body.voterFingerprint)));
    } else {
      await db
        .insert(machineVotes)
        .values({ machineId: id, voteType: body.voteType, voterFingerprint: body.voterFingerprint });
    }

    return c.json({ ok: true }, 200);
  })
  .get("/debug/db-stats", async (c) => {
    const totalMachines = await db.select().from(machines);
    const matchedCount = await db.select().from(videosTable).where(eq(videosTable.matchStatus, "matched"));
    const manualCount = await db.select().from(videosTable).where(eq(videosTable.matchStatus, "manual"));
    const unmatchedCount = await db.select().from(videosTable).where(eq(videosTable.matchStatus, "unmatched"));
    const manualExcludedCount = await db.select().from(videosTable).where(eq(videosTable.matchStatus, "manual_excluded"));
    
    const manualLinks = await db.select().from(videoMachineLinks).where(eq(videoMachineLinks.matchMethod, "manual"));
    const manualExcludedLinks = await db.select().from(videoMachineLinks).where(eq(videoMachineLinks.matchMethod, "manual_excluded"));
    
    return c.json({
      machinesCount: totalMachines.length,
      matchedVideosCount: matchedCount.length,
      manualVideosCount: manualCount.length,
      unmatchedVideosCount: unmatchedCount.length,
      manualExcludedVideosCount: manualExcludedCount.length,
      manualLinksCount: manualLinks.length,
      manualExcludedCount: manualExcludedLinks.length,
    }, 200);
  });
