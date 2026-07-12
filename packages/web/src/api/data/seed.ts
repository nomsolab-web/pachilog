/**
 * Run with: bun run packages/web/src/api/data/seed.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels } from "../database/schema";
import { SEED_CHANNELS } from "./seed-channels";

async function main() {
  let inserted = 0;
  for (const ch of SEED_CHANNELS) {
    const existing = await db.select().from(channels).where(eq(channels.handle, ch.handle));
    if (existing.length > 0) continue;
    await db.insert(channels).values({ handle: ch.handle, name: ch.name });
    inserted += 1;
  }
  console.log(`Seeded ${inserted} new channels (out of ${SEED_CHANNELS.length} total in list).`);
}

main().then(() => process.exit(0));
