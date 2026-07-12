import { eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots } from "../database/schema";

async function main() {
  const targets = await db.select().from(channels).where(inArray(channels.handle, ["@kimu_channel", "@scoooooooptv"]));
  for (const t of targets) {
    await db.delete(channelSnapshots).where(eq(channelSnapshots.channelId, t.id));
  }
  console.log("cleared snapshots for", targets.map((t) => t.name));
}

main().then(() => process.exit(0));
