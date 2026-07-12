/**
 * Second round of handle corrections after reviewing subscriber counts (some resolved to 0/wrong channels).
 * Run with: bun run packages/web/src/api/data/fix-handles-2.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels } from "../database/schema";

const FIXES: { oldHandle: string; newHandle: string }[] = [
  { oldHandle: "@kimuchannel", newHandle: "@kimu_channel" }, // きむちゃんねる
  { oldHandle: "@scooptv", newHandle: "@scoooooooptv" }, // スクープTV
];

// ワロス is a performer inside SEVEN'S TV (already tracked as its own channel), not a separate channel.
const DEACTIVATE_HANDLES = ["@warosu"];

async function main() {
  for (const fix of FIXES) {
    // clear the wrongly-resolved youtube_channel_id so collect/run re-resolves from the new handle
    await db
      .update(channels)
      .set({ handle: fix.newHandle, youtubeChannelId: null })
      .where(eq(channels.handle, fix.oldHandle));
    console.log(`updated ${fix.oldHandle} -> ${fix.newHandle}`);
  }
  for (const handle of DEACTIVATE_HANDLES) {
    await db.update(channels).set({ active: false }).where(eq(channels.handle, handle));
    console.log(`deactivated duplicate: ${handle}`);
  }
}

main().then(() => process.exit(0));
