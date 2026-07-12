import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../database";
import { channels, machineMentions, machineVotes, machines } from "../database/schema";
import { rateLimit } from "../middleware/rate-limit";

export const machinesRoute = new Hono()
  .get("/", async (c) => {
    const list = await db.select().from(machines);

    const withBuzz = await Promise.all(
      list.map(async (m) => {
        const mentions = await db.select().from(machineMentions).where(eq(machineMentions.machineId, m.id));
        const totalViews = mentions.reduce((sum, x) => sum + x.viewCount, 0);
        const videoCount = mentions.length;
        return { ...m, totalViews, videoCount };
      }),
    );

    withBuzz.sort((a, b) => b.totalViews - a.totalViews);
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
        channelName: channels.name,
      })
      .from(machineMentions)
      .innerJoin(channels, eq(machineMentions.channelId, channels.id))
      .where(eq(machineMentions.machineId, id))
      .orderBy(desc(machineMentions.viewCount));

    return c.json({ machine, mentions }, 200);
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
  });
