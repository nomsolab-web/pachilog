import { inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, videoMachineLinks, videos } from "../database/schema";

async function main() {
  const links = await db.select().from(videoMachineLinks);
  const activeLinks = links.filter((link) => link.matchMethod !== "manual_excluded");
  const videoIds = [...new Set(activeLinks.map((link) => link.videoId))];
  const videoRows = videoIds.length > 0 ? await db.select().from(videos).where(inArray(videos.videoId, videoIds)) : [];
  const videosById = new Map(videoRows.map((video) => [video.videoId, video]));

  await db.delete(machineMentions);

  let inserted = 0;
  for (const link of activeLinks) {
    const video = videosById.get(link.videoId);
    if (!video) continue;
    await db.insert(machineMentions).values({
      machineId: link.machineId,
      channelId: video.channelId,
      videoId: video.videoId,
      videoTitle: video.title,
      viewCount: video.viewCount,
      likeCount: video.likeCount,
      commentCount: video.commentCount,
      publishedAt: video.publishedAt,
    });
    inserted += 1;
  }

  console.log(`Rebuilt machine_mentions from video_machine_links: ${inserted} rows inserted.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error((err as Error).message);
    process.exit(1);
  });
