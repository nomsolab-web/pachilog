import { inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, machineVotes, machines, videoMachineLinks } from "../database/schema";

export const DEAD_MOUNT_DUPLICATE_DRY_RUN = {
  canonicalId: 6,
  duplicateId: 80,
  aliasToAdd: "eFデッドマウントデスプレイ 魂神9000",
} as const;

type Machine = typeof machines.$inferSelect;
type VideoMachineLink = typeof videoMachineLinks.$inferSelect;
type MachineMention = typeof machineMentions.$inferSelect;
type MachineVote = typeof machineVotes.$inferSelect;
type MachineVideoJudgment = typeof machineVideoJudgments.$inferSelect;

export async function runDeadMountDuplicateDryRun() {
  const { canonicalId, duplicateId } = DEAD_MOUNT_DUPLICATE_DRY_RUN;
  const ids = [canonicalId, duplicateId];

  const [machineRows, linkRows, mentionRows, voteRows, judgmentRows] = await Promise.all([
    db.select().from(machines).where(inArray(machines.id, ids)),
    db.select().from(videoMachineLinks).where(inArray(videoMachineLinks.machineId, ids)),
    db.select().from(machineMentions).where(inArray(machineMentions.machineId, ids)),
    db.select().from(machineVotes).where(inArray(machineVotes.machineId, ids)),
    db.select().from(machineVideoJudgments).where(inArray(machineVideoJudgments.machineId, ids)),
  ]);

  const canonical = machineRows.find((row) => row.id === canonicalId);
  const duplicate = machineRows.find((row) => row.id === duplicateId);

  return buildDeadMountDuplicateDryRunReport({
    canonical,
    duplicate,
    links: linkRows,
    mentions: mentionRows,
    votes: voteRows,
    judgments: judgmentRows,
  });
}

export function buildDeadMountDuplicateDryRunReport(input: {
  canonical: Machine | undefined;
  duplicate: Machine | undefined;
  links: readonly VideoMachineLink[];
  mentions: readonly MachineMention[];
  votes: readonly MachineVote[];
  judgments: readonly MachineVideoJudgment[];
}) {
  const { canonical, duplicate, links, mentions, votes, judgments } = input;
  const { canonicalId, duplicateId, aliasToAdd } = DEAD_MOUNT_DUPLICATE_DRY_RUN;

  const canonicalLinks = links.filter((row) => row.machineId === canonicalId);
  const duplicateLinks = links.filter((row) => row.machineId === duplicateId);
  const canonicalMentions = mentions.filter((row) => row.machineId === canonicalId);
  const duplicateMentions = mentions.filter((row) => row.machineId === duplicateId);
  const canonicalVotes = votes.filter((row) => row.machineId === canonicalId);
  const duplicateVotes = votes.filter((row) => row.machineId === duplicateId);
  const canonicalJudgments = judgments.filter((row) => row.machineId === canonicalId);
  const duplicateJudgments = judgments.filter((row) => row.machineId === duplicateId);
  const aliasAfter = mergeAliases(canonical?.aliases, duplicate?.name, aliasToAdd);

  return {
    applied: false,
    mode: "dry-run",
    writeCapability: "disabled",
    target: {
      canonicalId,
      duplicateId,
      aliasToAdd,
    },
    validation: {
      canonicalExists: !!canonical,
      duplicateExists: !!duplicate,
      makerMatches: !!canonical && !!duplicate && canonical.maker === duplicate.maker,
      typeMatches: !!canonical && !!duplicate && canonical.type === duplicate.type,
      releaseDateMatches: !!canonical && !!duplicate && canonical.releaseDate === duplicate.releaseDate,
      sharedVideoIds: intersect(
        canonicalLinks.map((row) => row.videoId),
        duplicateLinks.map((row) => row.videoId),
      ),
    },
    schemaReferences: [
      { table: "video_machine_links", column: "machine_id", uniqueKey: ["video_id", "machine_id"] },
      { table: "machine_mentions", column: "machine_id", uniqueKey: ["machine_id", "video_id"] },
      { table: "machine_votes", column: "machine_id", uniqueKey: ["machine_id", "voter_fingerprint"] },
      { table: "machine_video_judgments", column: "machine_id", uniqueKey: ["judgment_key"] },
    ],
    machines: {
      canonical: summarizeMachine(canonical, canonicalLinks, canonicalMentions, canonicalVotes, canonicalJudgments),
      duplicate: summarizeMachine(duplicate, duplicateLinks, duplicateMentions, duplicateVotes, duplicateJudgments),
    },
    aliasChange: {
      before: canonical?.aliases ?? [],
      after: aliasAfter,
      willAdd: aliasAfter.filter((alias) => !(canonical?.aliases ?? []).includes(alias)),
    },
    plannedChanges: {
      videoMachineLinks: planUniqueMove(canonicalLinks, duplicateLinks, (row) => row.videoId),
      machineMentions: planUniqueMove(canonicalMentions, duplicateMentions, (row) => row.videoId),
      machineVotes: planUniqueMove(canonicalVotes, duplicateVotes, (row) => row.voterFingerprint),
      machineVideoJudgments: {
        rowsToMove: duplicateJudgments.map((row) => row.id),
        uniqueConflictCandidates: [],
        dedupePolicy: "No table-level unique key on machine_id/video_id; move duplicate machine_id references to canonical ID.",
        before: { canonical: canonicalJudgments.length, duplicate: duplicateJudgments.length },
        after: { canonical: canonicalJudgments.length + duplicateJudgments.length, duplicate: 0 },
      },
      duplicateMachineDelete: {
        blockedInThisWorkflow: true,
        wouldDeleteAfterVerification: duplicate ? { table: "machines", id: duplicate.id, name: duplicate.name } : null,
      },
    },
    expectedAfterApplyInSeparateWorkflow: {
      canonicalDistinctVideoMachineLinks: new Set([...canonicalLinks, ...duplicateLinks].map((row) => row.videoId)).size,
      duplicateReferencesToVerifyBeforeDelete: {
        videoMachineLinks: 0,
        machineMentions: 0,
        machineVotes: 0,
        machineVideoJudgments: 0,
      },
      unrelatedRowsChanged: 0,
    },
  };
}

function summarizeMachine(
  machine: Machine | undefined,
  links: readonly VideoMachineLink[],
  mentions: readonly MachineMention[],
  votes: readonly MachineVote[],
  judgments: readonly MachineVideoJudgment[],
) {
  return {
    id: machine?.id ?? null,
    exists: !!machine,
    name: machine?.name ?? null,
    maker: machine?.maker ?? null,
    type: machine?.type ?? null,
    releaseDate: machine?.releaseDate ?? null,
    aliases: machine?.aliases ?? [],
    counts: {
      videoMachineLinks: links.length,
      distinctVideoMachineLinks: new Set(links.map((row) => row.videoId)).size,
      mentions: mentions.length,
      votes: votes.length,
      judgments: judgments.length,
    },
    records: {
      videoMachineLinks: links.map((row) => pick(row, ["id", "videoId", "machineId", "matchConfidence", "matchMethod", "createdAt", "updatedAt"])),
      mentions: mentions.map((row) => pick(row, ["id", "machineId", "channelId", "videoId", "videoTitle", "viewCount", "likeCount", "commentCount", "publishedAt", "updatedAt"])),
      votes: votes.map((row) => pick(row, ["id", "machineId", "voteType", "voterFingerprint", "createdAt"])),
      judgments: judgments.map((row) => pick(row, ["id", "judgmentKey", "machineId", "channelId", "videoId", "videoTitle", "status", "confidence", "reason", "createdAt", "updatedAt"])),
    },
  };
}

function planUniqueMove<T extends { id: number; machineId: number }>(
  canonicalRows: readonly T[],
  duplicateRows: readonly T[],
  key: (row: T) => string,
) {
  const canonicalKeys = new Set(canonicalRows.map(key));
  const rowsToMove = [];
  const uniqueConflictCandidates = [];
  for (const row of duplicateRows) {
    if (canonicalKeys.has(key(row))) uniqueConflictCandidates.push(row.id);
    else rowsToMove.push(row.id);
  }

  return {
    rowsToMove,
    uniqueConflictCandidates,
    dedupePolicy: "If the canonical row already has the same unique key, keep the canonical row and discard the duplicate row during a separate reviewed apply.",
    before: { canonical: canonicalRows.length, duplicate: duplicateRows.length },
    after: { canonical: canonicalRows.length + rowsToMove.length, duplicate: 0 },
  };
}

function mergeAliases(existing: string[] | null | undefined, ...aliases: Array<string | null | undefined>) {
  return [...new Set([...(existing ?? []), ...aliases.filter((value): value is string => !!value)])];
}

function intersect(a: readonly string[], b: readonly string[]) {
  const bSet = new Set(b);
  return [...new Set(a.filter((value) => bSet.has(value)))].sort();
}

function pick<T extends Record<string, unknown>, K extends keyof T>(row: T, keys: readonly K[]) {
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as Pick<T, K>;
}

if (import.meta.main) {
  runDeadMountDuplicateDryRun()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
