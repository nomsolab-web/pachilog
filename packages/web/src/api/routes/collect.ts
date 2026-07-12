import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots } from "../database/schema";
import { fetchChannelByHandle, fetchChannelsByIds } from "../lib/youtube";

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export const collect = new Hono().post("/run", async (c) => {
  const secret = c.req.header("x-collect-secret");
  if (!secret || secret !== process.env.COLLECT_SECRET_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const results = { resolved: 0, snapshotsInserted: 0, skippedExisting: 0, errors: [] as string[] };

  // 1. Resolve any active channels that only have a handle (no youtube_channel_id yet)
  const unresolved = await db
    .select()
    .from(channels)
    .where(and(isNull(channels.youtubeChannelId), eq(channels.active, true)));
  for (const ch of unresolved) {
    if (!ch.handle) continue;
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
      }
    } catch (err) {
      results.errors.push(`${ch.handle}: ${(err as Error).message}`);
    }
  }

  // 2. Fetch stats for all channels that now have a resolved youtube_channel_id
  const active = await db
    .select()
    .from(channels)
    .where(and(eq(channels.active, true)));

  const withIds = active.filter((ch) => !!ch.youtubeChannelId);
  const idToChannel = new Map(withIds.map((ch) => [ch.youtubeChannelId as string, ch]));

  if (withIds.length > 0) {
    const stats = await fetchChannelsByIds(withIds.map((ch) => ch.youtubeChannelId as string));
    const date = todayStr();

    for (const s of stats) {
      const ch = idToChannel.get(s.channelId);
      if (!ch) continue;

      const existing = await db
        .select()
        .from(channelSnapshots)
        .where(and(eq(channelSnapshots.channelId, ch.id), eq(channelSnapshots.date, date)));

      if (existing.length > 0) {
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

  return c.json(results, 200);
});
