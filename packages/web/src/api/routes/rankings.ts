import { Hono } from "hono";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots } from "../database/schema";
import { selectComparisonSnapshots } from "../lib/ranking";

const ALLOWED_PERIODS = new Set([1, 7, 30, 90]);

export const rankings = new Hono().get("/", async (c) => {
  const requestedPeriod = Number(c.req.query("period") ?? 7);
  const period = ALLOWED_PERIODS.has(requestedPeriod) ? requestedPeriod : 7;
  const activeChannels = await db.select().from(channels).where(eq(channels.active, true));
  const activeIds = activeChannels.map((channel) => channel.id);
  const snapshots =
    activeIds.length > 0
      ? await db
          .select()
          .from(channelSnapshots)
          .where(inArray(channelSnapshots.channelId, activeIds))
          .orderBy(desc(channelSnapshots.date), desc(channelSnapshots.collectedAt))
      : [];
  const snapshotsByChannelId = new Map<number, typeof snapshots>();
  for (const snapshot of snapshots) {
    const list = snapshotsByChannelId.get(snapshot.channelId) ?? [];
    list.push(snapshot);
    snapshotsByChannelId.set(snapshot.channelId, list);
  }

  const entries = activeChannels.map((channel) => {
      const channelSnapshotRows = snapshotsByChannelId.get(channel.id) ?? [];
      const { latest, base, comparisonDays, isProvisional, status, comparisonStartDate, comparisonEndDate } = selectComparisonSnapshots(
        channelSnapshotRows,
        period,
      );
      if (!latest || !base) return null;

      const delta = latest.subscriberCount - base.subscriberCount;
      const deltaPct = base.subscriberCount > 0 ? (delta / base.subscriberCount) * 100 : 0;

      return {
        id: channel.id,
        name: channel.name,
        youtubeChannelId: channel.youtubeChannelId,
        handle: channel.handle,
        category: channel.category,
        thumbnailUrl: channel.thumbnailUrl,
        latestSubscriberCount: latest.subscriberCount,
        latestDate: latest.date,
        snapshotCount: comparisonDays,
        comparisonDays,
        isProvisional,
        comparisonStatus: status,
        comparisonStartDate,
        comparisonEndDate,
        delta,
        deltaPct: Number(deltaPct.toFixed(2)),
      };
    });

  const valid = entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const rising = valid.filter((entry) => entry.delta > 0).sort((a, b) => b.delta - a.delta || a.name.localeCompare(b.name, "ja"));
  const falling = valid.filter((entry) => entry.delta < 0).sort((a, b) => a.delta - b.delta || a.name.localeCompare(b.name, "ja"));
  const insufficient = activeChannels
    .filter((channel) => !valid.some((entry) => entry.id === channel.id))
    .map((channel) => {
      const latest = (snapshotsByChannelId.get(channel.id) ?? [])[0] ?? null;
      return {
        id: channel.id,
        name: channel.name,
        youtubeChannelId: channel.youtubeChannelId,
        handle: channel.handle,
        category: channel.category,
        thumbnailUrl: channel.thumbnailUrl,
        latestSubscriberCount: latest?.subscriberCount ?? 0,
        latestDate: latest?.date ?? null,
        snapshotCount: snapshotsByChannelId.get(channel.id)?.length ?? 0,
        comparisonDays: 0,
        isProvisional: false,
        comparisonStatus: "insufficient",
        comparisonStartDate: null,
        comparisonEndDate: latest?.date ?? null,
        delta: 0,
        deltaPct: 0,
      };
    });

  return c.json({ period, rising, falling, insufficient, queryPlan: { activeChannels: 1, snapshots: 1 } }, 200);
});
