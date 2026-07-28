import { eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, machineVotes, machines, videos, videoMachineLinks } from "../database/schema";
import { selectRankableMachineVideos } from "../lib/machine-content";
import { machineIdentityKey } from "../lib/machine-identity";

export const DUPLICATE_MACHINE_GROUPS = [
  {
    canonicalId: 8,
    duplicateId: 5,
    label: "ベルセルク無双 第2章",
    canonical: { name: "デカスタeベルセルク無双 第2章 10連撃Ver.", maker: "ニューギン", type: "pachinko", releaseDate: "2026-07-21" },
  },
  {
    canonicalId: 6,
    duplicateId: 3,
    label: "デッドマウントデスプレイ",
    canonical: { name: "eフィーバー デッドマウント・デスプレイ 魂神9000", maker: "SANKYO", type: "pachinko", releaseDate: "2026-06-08" },
  },
  {
    canonicalId: 7,
    duplicateId: 4,
    label: "必殺仕事人VI",
    canonical: { name: "ぱちんこ 必殺仕事人VI", maker: "オッケー.", type: "pachinko", releaseDate: "2026-07-06" },
  },
] as const;

type MachineRecord = typeof machines.$inferSelect;
type LinkRecord = typeof videoMachineLinks.$inferSelect;
type RankableLinkRecord = {
  machineId: number;
  videoId: string;
  matchMethod: string;
  matchStatus: string | null;
  contentType: "standard" | "short" | "live" | "promotion" | "unknown";
};

export function validateDuplicateGroup(
  canonical: MachineRecord | undefined,
  duplicate: MachineRecord | undefined,
) {
  if (!canonical || !duplicate) return { ok: false, reason: "machine row missing" };
  if (machineIdentityKey(canonical) !== machineIdentityKey(duplicate)) return { ok: false, reason: "machine identity differs" };
  if (canonical.series && duplicate.series && canonical.series !== duplicate.series) return { ok: false, reason: "series differs" };
  return { ok: true, reason: "same normalized machine identity" };
}

const LINK_METHOD_PRIORITY: Record<string, number> = {
  manual: 4,
  manual_excluded: 3,
  exact_name: 2,
  alias: 1,
};

export function preferredLink(a: LinkRecord, b: LinkRecord) {
  if (a.matchMethod === "manual_excluded" || b.matchMethod === "manual_excluded") {
    return a.matchMethod === "manual_excluded" ? a : b;
  }
  const aRank = LINK_METHOD_PRIORITY[a.matchMethod] ?? 0;
  const bRank = LINK_METHOD_PRIORITY[b.matchMethod] ?? 0;
  if (aRank !== bRank) return aRank > bRank ? a : b;
  return a.matchConfidence >= b.matchConfidence ? a : b;
}

function unionStrings(...values: Array<string[] | null | undefined>) {
  return [...new Set(values.flatMap((value) => value ?? []))];
}

export function mergeMachineMetadataValues(
  canonical: MachineRecord,
  duplicate: MachineRecord,
  group: (typeof DUPLICATE_MACHINE_GROUPS)[number],
) {
  const scalar = <T>(first: T | null | undefined, second: T | null | undefined) => first ?? second ?? null;
  return {
    name: group.canonical.name,
    maker: group.canonical.maker,
    type: group.canonical.type,
    releaseDate: group.canonical.releaseDate,
    shortName: scalar(canonical.shortName, duplicate.shortName),
    series: scalar(canonical.series, duplicate.series),
    thumbnailUrl: scalar(canonical.thumbnailUrl, duplicate.thumbnailUrl),
    sourceUrl: scalar(canonical.sourceUrl, duplicate.sourceUrl),
    officialUrl: scalar(canonical.officialUrl, duplicate.officialUrl),
    aliases: unionStrings(canonical.aliases, duplicate.aliases),
    uniqueAliases: unionStrings(canonical.uniqueAliases, duplicate.uniqueAliases),
    ambiguousAliases: unionStrings(canonical.ambiguousAliases, duplicate.ambiguousAliases),
    resolvingKeywords: unionStrings(canonical.resolvingKeywords, duplicate.resolvingKeywords),
    excludeTerms: unionStrings(canonical.excludeTerms, duplicate.excludeTerms),
  };
}

async function mergeMachineMetadata(tx: any, group: (typeof DUPLICATE_MACHINE_GROUPS)[number]) {
  const rows = await tx.select().from(machines).where(inArray(machines.id, [group.canonicalId, group.duplicateId]));
  const canonical = rows.find((row: MachineRecord) => row.id === group.canonicalId);
  const duplicate = rows.find((row: MachineRecord) => row.id === group.duplicateId);
  if (!canonical || !duplicate) throw new Error(`Machine metadata missing for ${group.canonicalId}/${group.duplicateId}`);
  await tx.update(machines).set(mergeMachineMetadataValues(canonical, duplicate, group)).where(eq(machines.id, group.canonicalId));
}

export function mergeUniqueMachineRows<T extends { machineId: number }>(
  rows: readonly T[],
  canonicalId: number,
  duplicateId: number,
  key: (row: T) => string,
) {
  const merged = new Map<string, T>();
  const removedIds: number[] = [];
  for (const row of rows) {
    if (row.machineId !== canonicalId && row.machineId !== duplicateId) continue;
    const normalized = { ...row, machineId: canonicalId };
    const rowKey = key(normalized);
    if (merged.has(rowKey)) {
      const id = (row as T & { id?: number }).id;
      if (id !== undefined) removedIds.push(id);
    } else {
      merged.set(rowKey, normalized as T);
    }
  }
  return { rows: [...merged.values()], removedIds };
}

async function mergeLinks(tx: any, canonicalId: number, duplicateId: number) {
  const rows = await tx.select().from(videoMachineLinks).where(inArray(videoMachineLinks.machineId, [canonicalId, duplicateId]));
  const byVideo = new Map<string, LinkRecord>();
  for (const row of rows) {
    const current = byVideo.get(row.videoId);
    const candidate = { ...row, machineId: canonicalId };
    if (!current) byVideo.set(row.videoId, candidate);
    else byVideo.set(row.videoId, preferredLink(current, candidate));
  }
  for (const row of rows) await tx.delete(videoMachineLinks).where(eq(videoMachineLinks.id, row.id));
  for (const row of byVideo.values()) {
    await tx.insert(videoMachineLinks).values({
      videoId: row.videoId,
      machineId: canonicalId,
      matchConfidence: row.matchConfidence,
      matchMethod: row.matchMethod,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  return { before: rows.length, after: byVideo.size };
}

async function mergeMentions(tx: any, canonicalId: number, duplicateId: number) {
  const rows = await tx.select().from(machineMentions).where(inArray(machineMentions.machineId, [canonicalId, duplicateId]));
  const byVideo = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    const current = byVideo.get(row.videoId);
    if (!current || row.updatedAt > current.updatedAt) byVideo.set(row.videoId, row);
  }
  for (const row of rows) await tx.delete(machineMentions).where(eq(machineMentions.id, row.id));
  for (const row of byVideo.values()) {
    await tx.insert(machineMentions).values({ ...row, id: undefined, machineId: canonicalId });
  }
  return { before: rows.length, after: byVideo.size };
}

async function mergeVotes(tx: any, canonicalId: number, duplicateId: number) {
  const rows = await tx.select().from(machineVotes).where(inArray(machineVotes.machineId, [canonicalId, duplicateId]));
  const byVoter = new Map<string, typeof rows[number]>();
  for (const row of rows) if (!byVoter.has(row.voterFingerprint)) byVoter.set(row.voterFingerprint, row);
  for (const row of rows) await tx.delete(machineVotes).where(eq(machineVotes.id, row.id));
  for (const row of byVoter.values()) {
    await tx.insert(machineVotes).values({ machineId: canonicalId, voteType: row.voteType, voterFingerprint: row.voterFingerprint, createdAt: row.createdAt });
  }
  return { before: rows.length, after: byVoter.size };
}

async function mergeJudgments(tx: any, canonicalId: number, duplicateId: number) {
  const result = await tx.update(machineVideoJudgments).set({ machineId: canonicalId }).where(eq(machineVideoJudgments.machineId, duplicateId));
  return { updated: result.rowsAffected ?? 0 };
}

export async function mergeDuplicateMachineGroup(tx: any, group: (typeof DUPLICATE_MACHINE_GROUPS)[number]) {
  const existing = await tx.select({ id: machines.id }).from(machines).where(inArray(machines.id, [group.canonicalId, group.duplicateId]));
  if (existing.some((row: { id: number }) => row.id === group.canonicalId) && !existing.some((row: { id: number }) => row.id === group.duplicateId)) {
    return { alreadyMerged: true, verification: await verifyMergedMachineGroup(tx, group) };
  }
  await mergeMachineMetadata(tx, group);
  const links = await mergeLinks(tx, group.canonicalId, group.duplicateId);
  const mentions = await mergeMentions(tx, group.canonicalId, group.duplicateId);
  const votes = await mergeVotes(tx, group.canonicalId, group.duplicateId);
  const judgments = await mergeJudgments(tx, group.canonicalId, group.duplicateId);
  await tx.delete(machines).where(eq(machines.id, group.duplicateId));
  const verification = await verifyMergedMachineGroup(tx, group);
  return { alreadyMerged: false, links, mentions, votes, judgments, verification };
}

export async function verifyMergedMachineGroup(tx: any, group: (typeof DUPLICATE_MACHINE_GROUPS)[number]) {
  const canonicalRows = await tx.select({ id: machines.id }).from(machines).where(eq(machines.id, group.canonicalId));
  const duplicateRows = await tx.select({ id: machines.id }).from(machines).where(eq(machines.id, group.duplicateId));
  const [links, mentions, votes, judgments] = await Promise.all([
    tx.select({ id: videoMachineLinks.id }).from(videoMachineLinks).where(eq(videoMachineLinks.machineId, group.duplicateId)),
    tx.select({ id: machineMentions.id }).from(machineMentions).where(eq(machineMentions.machineId, group.duplicateId)),
    tx.select({ id: machineVotes.id }).from(machineVotes).where(eq(machineVotes.machineId, group.duplicateId)),
    tx.select({ id: machineVideoJudgments.id }).from(machineVideoJudgments).where(eq(machineVideoJudgments.machineId, group.duplicateId)),
  ]);
  const result = {
    canonicalId: group.canonicalId,
    canonicalCount: canonicalRows.length,
    duplicateId: group.duplicateId,
    duplicateCount: duplicateRows.length,
    orphanReferences: { videoMachineLinks: links.length, machineMentions: mentions.length, machineVotes: votes.length, machineVideoJudgments: judgments.length },
  };
  if (result.canonicalCount !== 1 || result.duplicateCount !== 0 || Object.values(result.orphanReferences).some((count) => count !== 0)) {
    throw new Error(`Post-merge verification failed for ${group.canonicalId}/${group.duplicateId}: ${JSON.stringify(result)}`);
  }
  return result;
}

export async function runDuplicateMachineMerge(apply: boolean) {
  const allMachines = await db.select().from(machines);
  const byId = new Map(allMachines.map((machine) => [machine.id, machine]));
  const validated = DUPLICATE_MACHINE_GROUPS.map((group) => ({
    ...group,
    validation: !byId.get(group.duplicateId) && byId.get(group.canonicalId)
      ? { ok: true, reason: "already merged" }
      : validateDuplicateGroup(byId.get(group.canonicalId), byId.get(group.duplicateId)),
  }));
  const rejected = validated.filter((group) => !group.validation.ok);
  if (rejected.length > 0) throw new Error(`Refusing merge: ${rejected.map((group) => `${group.duplicateId}: ${group.validation.reason}`).join(", ")}`);

  const pendingGroups = validated.filter((group) => group.validation.reason !== "already merged");
  if (pendingGroups.length === 0) {
    return { groups: validated, groupCounts: [], linksBefore: 0, linksAfter: 0, mentionsBefore: 0, mentionsAfter: 0, votesBefore: 0, votesAfter: 0, judgmentsBefore: 0, judgmentsToMove: 0, applied: false };
  }
  const ids = pendingGroups.flatMap((group) => [group.canonicalId, group.duplicateId]);
  const [links, mentions, votes, judgments] = await Promise.all([
    db.select().from(videoMachineLinks).where(inArray(videoMachineLinks.machineId, ids)),
    db.select().from(machineMentions).where(inArray(machineMentions.machineId, ids)),
    db.select().from(machineVotes).where(inArray(machineVotes.machineId, ids)),
    db.select().from(machineVideoJudgments).where(inArray(machineVideoJudgments.machineId, ids)),
  ]);
  const rankingRows: RankableLinkRecord[] = ids.length > 0
    ? await db
      .select({
        machineId: videoMachineLinks.machineId,
        videoId: videoMachineLinks.videoId,
        matchMethod: videoMachineLinks.matchMethod,
        matchStatus: videos.matchStatus,
        contentType: videos.contentType,
      })
      .from(videoMachineLinks)
      .innerJoin(videos, eq(videoMachineLinks.videoId, videos.videoId))
      .where(inArray(videoMachineLinks.machineId, ids))
    : [];
  const rankableRows = selectRankableMachineVideos(rankingRows);
  const groupCounts = pendingGroups.map((group) => ({
    canonicalId: group.canonicalId,
    duplicateId: group.duplicateId,
    label: group.label,
    machines: {
      canonical: machineDryRunSummary(byId.get(group.canonicalId), links, rankableRows, group.canonicalId),
      duplicate: machineDryRunSummary(byId.get(group.duplicateId), links, rankableRows, group.duplicateId),
    },
    linksBefore: links.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    linksAfter: new Set(links.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.videoId)).size,
    duplicateLinksToMove: links.filter((row) => row.machineId === group.duplicateId).length,
    duplicateLinksDeduplicated: links.filter((row) => row.machineId === group.duplicateId && links.some((other) => other.machineId === group.canonicalId && other.videoId === row.videoId)).length,
    mentionsBefore: mentions.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    mentionsAfter: new Set(mentions.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.videoId)).size,
    votesBefore: votes.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    votesAfter: new Set(votes.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.voterFingerprint)).size,
    judgmentsToMove: judgments.filter((row) => row.machineId === group.duplicateId).length,
    keepMachineId: group.canonicalId,
    duplicateRecordAction: byId.get(group.duplicateId)
      ? { action: "delete", machineId: group.duplicateId, name: byId.get(group.duplicateId)?.name ?? null }
      : { action: "none", machineId: group.duplicateId, reason: "already absent" },
    rankingConsolidation: {
      beforeMachineIds: [group.canonicalId, group.duplicateId].filter((id) => byId.has(id)),
      afterMachineIds: [group.canonicalId],
      expectedSingleRankingEntry: byId.has(group.canonicalId) && byId.has(group.duplicateId),
      rankableVideosBefore: {
        canonical: uniqueVideoCount(rankableRows, group.canonicalId),
        duplicate: uniqueVideoCount(rankableRows, group.duplicateId),
      },
      rankableVideosAfter: new Set(rankableRows.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.videoId)).size,
    },
    otherMachineImpact: {
      affectedMachineIds: [group.canonicalId, group.duplicateId],
      outsideMachineRowsChanged: 0,
    },
  }));
  const report = { groups: validated, groupCounts, linksBefore: links.length, linksAfter: groupCounts.reduce((sum, group) => sum + group.linksAfter, 0), mentionsBefore: mentions.length, mentionsAfter: groupCounts.reduce((sum, group) => sum + group.mentionsAfter, 0), votesBefore: votes.length, votesAfter: groupCounts.reduce((sum, group) => sum + group.votesAfter, 0), judgmentsBefore: judgments.length, judgmentsToMove: groupCounts.reduce((sum, group) => sum + group.judgmentsToMove, 0), applied: false };
  if (!apply) return report;

  const verification = await db.transaction(async (tx) => {
    const results = [];
    for (const group of pendingGroups) {
      results.push(await mergeDuplicateMachineGroup(tx, group));
    }
    return results.map((result) => result.verification);
  });
  return { ...report, applied: true, verification };
}

function machineDryRunSummary(
  machine: MachineRecord | undefined,
  links: readonly LinkRecord[],
  rankableRows: readonly RankableLinkRecord[],
  machineId: number,
) {
  const machineLinks = links.filter((row) => row.machineId === machineId);
  return {
    id: machineId,
    exists: !!machine,
    name: machine?.name ?? null,
    maker: machine?.maker ?? null,
    releaseDate: machine?.releaseDate ?? null,
    linkedVideoCount: new Set(machineLinks.map((row) => row.videoId)).size,
    videoMachineLinksCount: machineLinks.length,
    rankableVideoCount: uniqueVideoCount(rankableRows, machineId),
  };
}

function uniqueVideoCount(rows: readonly { machineId: number; videoId: string }[], machineId: number) {
  return new Set(rows.filter((row) => row.machineId === machineId).map((row) => row.videoId)).size;
}

if (import.meta.main) {
  const apply = process.argv.includes("--apply");
  const jsonOnly = process.argv.includes("--json");
  runDuplicateMachineMerge(apply)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!apply && !jsonOnly) console.log("Dry-run only. Re-run with --apply to execute the transactional merge.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
