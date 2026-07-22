import { eq } from "drizzle-orm";
import { db } from "../database";
import { channels, videos } from "../database/schema";
import { classifyVideoContent } from "../lib/content-type";

async function main() {
  const [videoRows, channelRows] = await Promise.all([db.select().from(videos), db.select().from(channels)]);
  const channelsById = new Map(channelRows.map((channel) => [channel.id, channel]));
  let updated = 0;

  for (const video of videoRows) {
    const channel = channelsById.get(video.channelId);
    const classification = classifyVideoContent({
      title: video.title,
      durationSeconds: video.durationSeconds,
      liveBroadcastContent: video.liveBroadcastContent,
      channelCategory: channel?.category,
    });
    await db
      .update(videos)
      .set({
        contentType: classification.contentType,
        contentTypeReason: classification.reason,
        contentTypeConfidence: classification.confidence,
        updatedAt: new Date(),
      })
      .where(eq(videos.videoId, video.videoId));
    updated += 1;
  }

  console.log(`Reclassified ${updated} videos.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
