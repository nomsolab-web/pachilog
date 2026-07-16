import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots } from "../database/schema";
import { shouldInsertSnapshot } from "../lib/collection";
import { dateStringInTimeZone } from "../lib/date";
import {
  fetchChannelByHandle,
  fetchChannelsByIdsSafe,
  isSuccessfulCollectionRate,
  mapWithConcurrency,
} from "../lib/youtube";

export const collect = new Hono().post("/run", async (c) => {
  const secret = c.req.header("x-collect-secret");
  if (!secret || secret !== process.env.COLLECT_SECRET_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const date = dateStringInTimeZone();
  const results = {
    date,
    resolved: 0,
    channelsRequested: 0,
    channelsFetched: 0,
    snapshotsInserted: 0,
    skippedExisting: 0,
    failedChannels: 0,
    errors: [] as string[],
  };

  // 1. Resolve any active channels that only have a handle (no youtube_channel_id yet)
  const unresolved = await db
    .select()
    .from(channels)
    .where(and(isNull(channels.youtubeChannelId), eq(channels.active, true)));
  await mapWithConcurrency(unresolved, 5, async (ch) => {
    if (!ch.handle) return;
    try {
      const stats = await fetchChannelByHandle(ch.handle);
      if (stats) {
        await db
          .update(channels)
          .set({
            youtubeChannelId: stats.channelId,
            name: stats.name,
            thumbnailUrl: stats.thumbnailUrl,
          })
          .where(eq(channels.id, ch.id));
        results.resolved += 1;
      } else {
        results.errors.push(`could not resolve handle ${ch.handle}`);
        results.failedChannels += 1;
      }
    } catch (err) {
      results.errors.push(`${ch.handle}: ${(err as Error).message}`);
      results.failedChannels += 1;
    }
  });

  // 2. Fetch stats for all channels that now have a resolved youtube_channel_id
  const active = await db
    .select()
    .from(channels)
    .where(and(eq(channels.active, true)));

  const withIds = active.filter((ch) => !!ch.youtubeChannelId);
  results.channelsRequested = withIds.length;
  const idToChannel = new Map(withIds.map((ch) => [ch.youtubeChannelId as string, ch]));

  if (withIds.length > 0) {
    const batchResult = await fetchChannelsByIdsSafe(withIds.map((ch) => ch.youtubeChannelId as string));
    const stats = batchResult.items;
    results.errors.push(...batchResult.errors);
    results.channelsFetched = stats.length;

    const fetchedIds = new Set(stats.map((item) => item.channelId));
    for (const ch of withIds) {
      if (ch.youtubeChannelId && !fetchedIds.has(ch.youtubeChannelId)) {
        results.errors.push(`${ch.name}: channel statistics were not returned by YouTube`);
        results.failedChannels += 1;
      }
    }

    for (const s of stats) {
      const ch = idToChannel.get(s.channelId);
      if (!ch) continue;

      if (s.thumbnailUrl !== ch.thumbnailUrl || s.name !== ch.name) {
        await db
          .update(channels)
          .set({
            name: s.name,
            thumbnailUrl: s.thumbnailUrl,
          })
          .where(eq(channels.id, ch.id));
      }

      const existing = await db
        .select()
        .from(channelSnapshots)
        .where(and(eq(channelSnapshots.channelId, ch.id), eq(channelSnapshots.date, date)));

      if (!shouldInsertSnapshot(existing.map((row) => row.date), date)) {
        results.skippedExisting += 1;
        continue;
      }

      await db.insert(channelSnapshots).values({
        channelId: ch.id,
        date,
        subscriberCount: s.subscriberCount,
        viewCount: s.viewCount,
        videoCount: s.videoCount,
      });
      results.snapshotsInserted += 1;
    }
  }

  const ok = isSuccessfulCollectionRate(results.channelsFetched, results.channelsRequested);
  return c.json(results, ok ? 200 : 502);
});
