/**
 * Run with: bun run packages/web/src/api/data/seed.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels } from "../database/schema";
import { SEED_CHANNELS } from "./seed-channels";

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const ch of SEED_CHANNELS) {
    const existingById = await db.select().from(channels).where(eq(channels.youtubeChannelId, ch.youtubeChannelId));
    if (existingById.length > 0) {
      await db
        .update(channels)
        .set({
          handle: ch.handle ?? existingById[0].handle,
          name: ch.name,
          category: ch.category,
          active: ch.active,
        })
        .where(eq(channels.youtubeChannelId, ch.youtubeChannelId));
      updated += 1;
      continue;
    }

    const existingByHandle = ch.handle ? await db.select().from(channels).where(eq(channels.handle, ch.handle)) : [];
    if (existingByHandle.length > 0) {
      await db
        .update(channels)
        .set({
          youtubeChannelId: ch.youtubeChannelId,
          name: ch.name,
          category: ch.category,
          active: ch.active,
        })
        .where(eq(channels.handle, ch.handle));
      updated += 1;
      continue;
    }

    await db.insert(channels).values({
      handle: ch.handle,
      youtubeChannelId: ch.youtubeChannelId,
      name: ch.name,
      category: ch.category,
      active: ch.active,
    });
    inserted += 1;
  }
  console.log(`Seeded ${inserted} new channels and updated ${updated} existing channels (out of ${SEED_CHANNELS.length}).`);
}

main().then(() => process.exit(0));
