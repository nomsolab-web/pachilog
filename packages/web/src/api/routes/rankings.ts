import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots } from "../database/schema";

const ALLOWED_PERIODS = new Set([7, 30, 90]);

export const rankings = new Hono().get("/", async (c) => {
  const requestedPeriod = Number(c.req.query("period") ?? 7);
  const period = ALLOWED_PERIODS.has(requestedPeriod) ? requestedPeriod : 7;
  const activeChannels = await db.select().from(channels).where(eq(channels.active, true));

  const entries = await Promise.all(
    activeChannels.map(async (channel) => {
      const snapshots = await db
        .select()
        .from(channelSnapshots)
        .where(eq(channelSnapshots.channelId, channel.id))
        .orderBy(desc(channelSnapshots.date))
        .limit(period + 1);

      const latest = snapshots[0];
      const base = snapshots[snapshots.length - 1];
      if (!latest || !base) return null;

      const delta = latest.subscriberCount - base.subscriberCount;
      const deltaPct = base.subscriberCount > 0 ? (delta / base.subscriberCount) * 100 : 0;

      return {
        id: channel.id,
        name: channel.name,
        thumbnailUrl: channel.thumbnailUrl,
        latestSubscriberCount: latest.subscriberCount,
        latestDate: latest.date,
        delta,
        deltaPct: Number(deltaPct.toFixed(2)),
      };
    }),
  );

  const valid = entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const rising = [...valid].sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, "ja"));
  const falling = [...valid].sort((a, b) => a.delta - b.delta || a.name.localeCompare(b.name, "ja"));

  return c.json({ period, rising, falling }, 200);
});
