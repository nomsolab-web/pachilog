import { Hono } from "hono";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots, votes } from "../database/schema";
import { rateLimit } from "../middleware/rate-limit";

export const channelsRoute = new Hono()
  .get("/", async (c) => {
    const list = await db.select().from(channels).where(eq(channels.active, true));

    const withStats = await Promise.all(
      list.map(async (ch) => {
        const snapshots = await db
          .select()
          .from(channelSnapshots)
          .where(eq(channelSnapshots.channelId, ch.id))
          .orderBy(desc(channelSnapshots.date))
          .limit(8);

        const latest = snapshots[0] ?? null;
        const weekAgo = snapshots[snapshots.length - 1] ?? null;
        const delta =
          latest && weekAgo && snapshots.length > 1 ? latest.subscriberCount - weekAgo.subscriberCount : 0;
        const deltaPct = latest && weekAgo && weekAgo.subscriberCount > 0 ? (delta / weekAgo.subscriberCount) * 100 : 0;

        return {
          ...ch,
          latestSubscriberCount: latest?.subscriberCount ?? null,
          latestViewCount: latest?.viewCount ?? null,
          latestDate: latest?.date ?? null,
          weeklyDelta: delta,
          weeklyDeltaPct: Number(deltaPct.toFixed(2)),
        };
      }),
    );

    return c.json({ channels: withStats }, 200);
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const [ch] = await db.select().from(channels).where(eq(channels.id, id));
    if (!ch) return c.json({ error: "not found" }, 404);

    const snapshots = await db
      .select()
      .from(channelSnapshots)
      .where(eq(channelSnapshots.channelId, id))
      .orderBy(asc(channelSnapshots.date));

    return c.json({ channel: ch, snapshots }, 200);
  })
  .get("/:id/votes", async (c) => {
    const id = Number(c.req.param("id"));
    const all = await db.select().from(votes).where(eq(votes.channelId, id));
    const counts = { good: 0, bad: 0, unknown: 0 };
    for (const v of all) counts[v.voteType as keyof typeof counts] += 1;
    const total = counts.good + counts.bad + counts.unknown;
    return c.json({ counts, total }, 200);
  })
  .post("/:id/votes", rateLimit({ limit: 5, windowMs: 60_000 }), async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json<{ voteType: "good" | "bad" | "unknown"; voterFingerprint: string }>();
    if (!["good", "bad", "unknown"].includes(body.voteType) || !body.voterFingerprint) {
      return c.json({ error: "invalid body" }, 400);
    }

    const existing = await db
      .select()
      .from(votes)
      .where(and(eq(votes.channelId, id), eq(votes.voterFingerprint, body.voterFingerprint)));

    if (existing.length > 0) {
      await db
        .update(votes)
        .set({ voteType: body.voteType })
        .where(and(eq(votes.channelId, id), eq(votes.voterFingerprint, body.voterFingerprint)));
    } else {
      await db.insert(votes).values({ channelId: id, voteType: body.voteType, voterFingerprint: body.voterFingerprint });
    }

    return c.json({ ok: true }, 200);
  });
