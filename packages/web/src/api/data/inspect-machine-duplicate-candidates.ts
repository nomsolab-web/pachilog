import { inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, machineVotes, machines, videos, videoMachineLinks } from "../database/schema";

const DEFAULT_MACHINE_IDS = [6, 80] as const;

export async function inspectMachineDuplicateCandidates(machineIds = DEFAULT_MACHINE_IDS) {
  const ids = [...new Set(machineIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length < 2) throw new Error("Provide at least two machine IDs to inspect.");

  const [machineRows, linkRows, mentionRows, voteRows, judgmentRows] = await Promise.all([
    db.select().from(machines).where(inArray(machines.id, ids)),
    db.select().from(videoMachineLinks).where(inArray(videoMachineLinks.machineId, ids)),
    db.select().from(machineMentions).where(inArray(machineMentions.machineId, ids)),
    db.select().from(machineVotes).where(inArray(machineVotes.machineId, ids)),
    db.select().from(machineVideoJudgments).where(inArray(machineVideoJudgments.machineId, ids)),
  ]);

  const videoIds = [...new Set(linkRows.map((row) => row.videoId))];
  const videoRows = videoIds.length > 0
    ? await db
      .select({
        videoId: videos.videoId,
        title: videos.title,
        channelId: videos.channelId,
        contentType: videos.contentType,
        matchStatus: videos.matchStatus,
        publishedAt: videos.publishedAt,
        viewCount: videos.viewCount,
      })
      .from(videos)
      .where(inArray(videos.videoId, videoIds))
    : [];
  const videosById = new Map(videoRows.map((row) => [row.videoId, row]));

  return {
    inspectedMachineIds: ids,
    applied: false,
    note: "Read-only inspection. This command does not merge, delete, or update records.",
    machines: ids.map((id) => {
      const machine = machineRows.find((row) => row.id === id);
      const links = linkRows.filter((row) => row.machineId === id);
      const mentions = mentionRows.filter((row) => row.machineId === id);
      const votes = voteRows.filter((row) => row.machineId === id);
      const judgments = judgmentRows.filter((row) => row.machineId === id);
      return {
        id,
        exists: !!machine,
        name: machine?.name ?? null,
        maker: machine?.maker ?? null,
        type: machine?.type ?? null,
        releaseDate: machine?.releaseDate ?? null,
        aliases: machine?.aliases ?? [],
        uniqueAliases: machine?.uniqueAliases ?? [],
        ambiguousAliases: machine?.ambiguousAliases ?? [],
        relatedVideos: links.map((link) => {
          const video = videosById.get(link.videoId);
          return {
            videoId: link.videoId,
            title: video?.title ?? null,
            channelId: video?.channelId ?? null,
            contentType: video?.contentType ?? null,
            matchStatus: video?.matchStatus ?? null,
            matchMethod: link.matchMethod,
            matchConfidence: link.matchConfidence,
            publishedAt: video?.publishedAt ?? null,
            viewCount: video?.viewCount ?? null,
          };
        }),
        counts: {
          videoMachineLinks: links.length,
          distinctRelatedVideos: new Set(links.map((row) => row.videoId)).size,
          mentions: mentions.length,
          votes: votes.length,
          judgments: judgments.length,
        },
      };
    }),
    comparison: {
      sharedVideoIds: intersectByVideoId(ids, linkRows),
      outsideMachineRowsChanged: 0,
      recommendedNextStep: "Review this report and decide the canonical machine manually before preparing a separate merge apply change.",
    },
  };
}

function intersectByVideoId(machineIds: readonly number[], links: readonly (typeof videoMachineLinks.$inferSelect)[]) {
  const sets = machineIds.map((id) => new Set(links.filter((row) => row.machineId === id).map((row) => row.videoId)));
  if (sets.length === 0) return [];
  return [...sets[0]].filter((videoId) => sets.every((set) => set.has(videoId))).sort();
}

if (import.meta.main) {
  const ids = process.argv
    .slice(2)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
  inspectMachineDuplicateCandidates(ids.length > 0 ? ids : DEFAULT_MACHINE_IDS)
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
