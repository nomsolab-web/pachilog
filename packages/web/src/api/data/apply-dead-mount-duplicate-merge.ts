import { eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, machineVotes, machines, videoMachineLinks } from "../database/schema";

export const DEAD_MOUNT_DUPLICATE_APPLY = {
  canonicalId: 6,
  duplicateId: 80,
  aliasesToAdd: ["eFデッドマウントデスプレイ 魂神9000", "eFデッドマウントデスプレイ 魂神9000"],
  expectedVideoMachineLinkIds: [1565, 1681, 1988],
  expectedMachineMentionIds: [1572, 1689],
  expectedMachineVoteIds: [],
  expectedMachineVideoJudgmentIds: [],
  expectedDistinctVideoCount: 4,
} as const;

type Machine = typeof machines.$inferSelect;
type VideoMachineLink = typeof videoMachineLinks.$inferSelect;
type MachineMention = typeof machineMentions.$inferSelect;
type MachineVote = typeof machineVotes.$inferSelect;
type MachineVideoJudgment = typeof machineVideoJudgments.$inferSelect;

type MergeSnapshot = {
  canonical: Machine | undefined;
  duplicate: Machine | undefined;
  links: VideoMachineLink[];
  mentions: MachineMention[];
  votes: MachineVote[];
  judgments: MachineVideoJudgment[];
};

export async function applyDeadMountDuplicateMerge() {
  return await db.transaction(async (tx) => {
    const before = await loadSnapshot(tx);
    const alreadyMerged = isAlreadyMerged(before);
    if (alreadyMerged) {
      const verification = verifyMergedState(before);
      return buildReport({
        alreadyMerged: true,
        addedAliases: [],
        movedVideoMachineLinks: [],
        movedMachineMentions: [],
        movedMachineVotes: [],
        movedMachineVideoJudgments: [],
        deletedMachineId: null,
        verification,
      });
    }

    validatePreApplySnapshot(before);

    const aliasesBefore = before.canonical?.aliases ?? [];
    const aliasesAfter = mergeAliases(aliasesBefore, ...DEAD_MOUNT_DUPLICATE_APPLY.aliasesToAdd);
    const addedAliases = aliasesAfter.filter((alias) => !aliasesBefore.includes(alias));

    await tx.update(machines).set({ aliases: aliasesAfter, updatedAt: new Date() }).where(eq(machines.id, DEAD_MOUNT_DUPLICATE_APPLY.canonicalId));
    await tx
      .update(videoMachineLinks)
      .set({ machineId: DEAD_MOUNT_DUPLICATE_APPLY.canonicalId, updatedAt: new Date() })
      .where(inArray(videoMachineLinks.id, [...DEAD_MOUNT_DUPLICATE_APPLY.expectedVideoMachineLinkIds]));
    await tx
      .update(machineMentions)
      .set({ machineId: DEAD_MOUNT_DUPLICATE_APPLY.canonicalId, updatedAt: new Date() })
      .where(inArray(machineMentions.id, [...DEAD_MOUNT_DUPLICATE_APPLY.expectedMachineMentionIds]));

    const afterMove = await loadSnapshot(tx);
    const zeroReferences = countDuplicateReferences(afterMove);
    if (Object.values(zeroReferences).some((count) => count !== 0)) {
      throw new Error(`Refusing to delete duplicate machine: residual references remain ${JSON.stringify(zeroReferences)}`);
    }

    const distinctVideoCount = distinctCanonicalVideoCount(afterMove);
    if (distinctVideoCount !== DEAD_MOUNT_DUPLICATE_APPLY.expectedDistinctVideoCount) {
      throw new Error(`Post-move distinct video count mismatch: expected ${DEAD_MOUNT_DUPLICATE_APPLY.expectedDistinctVideoCount}, got ${distinctVideoCount}`);
    }

    await tx.delete(machines).where(eq(machines.id, DEAD_MOUNT_DUPLICATE_APPLY.duplicateId));

    const afterDelete = await loadSnapshot(tx);
    const verification = verifyMergedState(afterDelete);
    return buildReport({
      alreadyMerged: false,
      addedAliases,
      movedVideoMachineLinks: [...DEAD_MOUNT_DUPLICATE_APPLY.expectedVideoMachineLinkIds],
      movedMachineMentions: [...DEAD_MOUNT_DUPLICATE_APPLY.expectedMachineMentionIds],
      movedMachineVotes: [],
      movedMachineVideoJudgments: [],
      deletedMachineId: DEAD_MOUNT_DUPLICATE_APPLY.duplicateId,
      verification,
    });
  });
}

async function loadSnapshot(tx: typeof db): Promise<MergeSnapshot> {
  const { canonicalId, duplicateId } = DEAD_MOUNT_DUPLICATE_APPLY;
  const ids = [canonicalId, duplicateId];
  const [machineRows, links, mentions, votes, judgments] = await Promise.all([
    tx.select().from(machines).where(inArray(machines.id, ids)),
    tx.select().from(videoMachineLinks).where(inArray(videoMachineLinks.machineId, ids)),
    tx.select().from(machineMentions).where(inArray(machineMentions.machineId, ids)),
    tx.select().from(machineVotes).where(inArray(machineVotes.machineId, ids)),
    tx.select().from(machineVideoJudgments).where(inArray(machineVideoJudgments.machineId, ids)),
  ]);
  return {
    canonical: machineRows.find((row) => row.id === canonicalId),
    duplicate: machineRows.find((row) => row.id === duplicateId),
    links,
    mentions,
    votes,
    judgments,
  };
}

function validatePreApplySnapshot(snapshot: MergeSnapshot) {
  const { canonicalId, duplicateId, expectedVideoMachineLinkIds, expectedMachineMentionIds, expectedMachineVoteIds, expectedMachineVideoJudgmentIds } =
    DEAD_MOUNT_DUPLICATE_APPLY;
  const { canonical, duplicate, links, mentions, votes, judgments } = snapshot;
  if (!canonical || !duplicate) throw new Error(`Expected both machine IDs ${canonicalId} and ${duplicateId} to exist before apply.`);
  if (canonical.maker !== duplicate.maker || canonical.type !== duplicate.type || canonical.releaseDate !== duplicate.releaseDate) {
    throw new Error("Refusing merge: maker, type, or releaseDate no longer match.");
  }

  assertExactIds("video_machine_links", duplicateIds(links, duplicateId), expectedVideoMachineLinkIds);
  assertExactIds("machine_mentions", duplicateIds(mentions, duplicateId), expectedMachineMentionIds);
  assertExactIds("machine_votes", duplicateIds(votes, duplicateId), expectedMachineVoteIds);
  assertExactIds("machine_video_judgments", duplicateIds(judgments, duplicateId), expectedMachineVideoJudgmentIds);

  const linkConflicts = conflictIds(links, duplicateId, canonicalId, (row) => row.videoId);
  const mentionConflicts = conflictIds(mentions, duplicateId, canonicalId, (row) => row.videoId);
  const voteConflicts = conflictIds(votes, duplicateId, canonicalId, (row) => row.voterFingerprint);
  if (linkConflicts.length > 0 || mentionConflicts.length > 0 || voteConflicts.length > 0) {
    throw new Error(`Refusing merge: unique conflicts detected ${JSON.stringify({ videoMachineLinks: linkConflicts, machineMentions: mentionConflicts, machineVotes: voteConflicts })}`);
  }
}

function isAlreadyMerged(snapshot: MergeSnapshot) {
  return !!snapshot.canonical && !snapshot.duplicate && Object.values(countDuplicateReferences(snapshot)).every((count) => count === 0);
}

function verifyMergedState(snapshot: MergeSnapshot) {
  const verification = {
    canonicalId: DEAD_MOUNT_DUPLICATE_APPLY.canonicalId,
    duplicateId: DEAD_MOUNT_DUPLICATE_APPLY.duplicateId,
    canonicalExists: !!snapshot.canonical,
    duplicateExists: !!snapshot.duplicate,
    duplicateReferences: countDuplicateReferences(snapshot),
    canonicalDistinctVideoMachineLinks: distinctCanonicalVideoCount(snapshot),
  };
  if (!verification.canonicalExists || verification.duplicateExists) {
    throw new Error(`Post-merge machine verification failed: ${JSON.stringify(verification)}`);
  }
  if (Object.values(verification.duplicateReferences).some((count) => count !== 0)) {
    throw new Error(`Post-merge reference verification failed: ${JSON.stringify(verification)}`);
  }
  if (verification.canonicalDistinctVideoMachineLinks !== DEAD_MOUNT_DUPLICATE_APPLY.expectedDistinctVideoCount) {
    throw new Error(`Post-merge distinct video verification failed: ${JSON.stringify(verification)}`);
  }
  return verification;
}

function countDuplicateReferences(snapshot: MergeSnapshot) {
  const duplicateId = DEAD_MOUNT_DUPLICATE_APPLY.duplicateId;
  return {
    videoMachineLinks: snapshot.links.filter((row) => row.machineId === duplicateId).length,
    machineMentions: snapshot.mentions.filter((row) => row.machineId === duplicateId).length,
    machineVotes: snapshot.votes.filter((row) => row.machineId === duplicateId).length,
    machineVideoJudgments: snapshot.judgments.filter((row) => row.machineId === duplicateId).length,
  };
}

function distinctCanonicalVideoCount(snapshot: MergeSnapshot) {
  return new Set(snapshot.links.filter((row) => row.machineId === DEAD_MOUNT_DUPLICATE_APPLY.canonicalId).map((row) => row.videoId)).size;
}

function duplicateIds<T extends { id: number; machineId: number }>(rows: readonly T[], duplicateId: number) {
  return rows.filter((row) => row.machineId === duplicateId).map((row) => row.id);
}

function assertExactIds(table: string, actual: readonly number[], expected: readonly number[]) {
  const actualSorted = [...actual].sort((a, b) => a - b);
  const expectedSorted = [...expected].sort((a, b) => a - b);
  if (actualSorted.length !== expectedSorted.length || actualSorted.some((id, index) => id !== expectedSorted[index])) {
    throw new Error(`Refusing merge: ${table} duplicate rows changed since dry-run. expected=${JSON.stringify(expectedSorted)} actual=${JSON.stringify(actualSorted)}`);
  }
}

function conflictIds<T extends { id: number; machineId: number }>(
  rows: readonly T[],
  duplicateId: number,
  canonicalId: number,
  key: (row: T) => string,
) {
  const canonicalKeys = new Set(rows.filter((row) => row.machineId === canonicalId).map(key));
  return rows.filter((row) => row.machineId === duplicateId && canonicalKeys.has(key(row))).map((row) => row.id);
}

function mergeAliases(existing: readonly string[] | null | undefined, ...aliases: readonly string[]) {
  return [...new Set([...(existing ?? []), ...aliases])];
}

function buildReport(input: {
  alreadyMerged: boolean;
  addedAliases: string[];
  movedVideoMachineLinks: number[];
  movedMachineMentions: number[];
  movedMachineVotes: number[];
  movedMachineVideoJudgments: number[];
  deletedMachineId: number | null;
  verification: ReturnType<typeof verifyMergedState>;
}) {
  return {
    applied: true,
    alreadyMerged: input.alreadyMerged,
    target: {
      canonicalId: DEAD_MOUNT_DUPLICATE_APPLY.canonicalId,
      duplicateId: DEAD_MOUNT_DUPLICATE_APPLY.duplicateId,
    },
    moved: {
      videoMachineLinks: { count: input.movedVideoMachineLinks.length, ids: input.movedVideoMachineLinks },
      machineMentions: { count: input.movedMachineMentions.length, ids: input.movedMachineMentions },
      machineVotes: { count: input.movedMachineVotes.length, ids: input.movedMachineVotes },
      machineVideoJudgments: { count: input.movedMachineVideoJudgments.length, ids: input.movedMachineVideoJudgments },
    },
    addedAliases: input.addedAliases,
    deletedMachineId: input.deletedMachineId,
    verification: input.verification,
  };
}

if (import.meta.main) {
  applyDeadMountDuplicateMerge()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
