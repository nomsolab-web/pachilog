import { eq, inArray } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, machineVotes, machines, videoMachineLinks } from "../database/schema";
import { normalizeMachineType } from "../../shared/machine-type";
import { normalizeMachineName } from "../lib/machine-identity";

export const DUPLICATE_MACHINE_GROUPS = [
  { canonicalId: 8, duplicateId: 5, label: "ベルセルク無双 第2章" },
  { canonicalId: 6, duplicateId: 3, label: "デッドマウントデスプレイ" },
  { canonicalId: 7, duplicateId: 4, label: "必殺仕事人VI" },
] as const;

type MachineRecord = typeof machines.$inferSelect;
type LinkRecord = typeof videoMachineLinks.$inferSelect;

export function comparableDuplicateName(name: string, label: string) {
  const normalized = normalizeMachineName(name);
  return label === "デッドマウントデスプレイ" ? normalized.replace(/9000$/, "") : normalized;
}

export function validateDuplicateGroup(
  canonical: MachineRecord | undefined,
  duplicate: MachineRecord | undefined,
  label: string,
) {
  if (!canonical || !duplicate) return { ok: false, reason: "machine row missing" };
  if (canonical.releaseDate !== duplicate.releaseDate) return { ok: false, reason: "release date differs" };
  if (normalizeMachineType(canonical.type) !== normalizeMachineType(duplicate.type)) return { ok: false, reason: "type differs" };
  if (comparableDuplicateName(canonical.name, label) !== comparableDuplicateName(duplicate.name, label)) {
    return { ok: false, reason: "normalized name differs" };
  }
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
  const aRank = LINK_METHOD_PRIORITY[a.matchMethod] ?? 0;
  const bRank = LINK_METHOD_PRIORITY[b.matchMethod] ?? 0;
  if (aRank !== bRank) return aRank > bRank ? a : b;
  return a.matchConfidence >= b.matchConfidence ? a : b;
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

export async function runDuplicateMachineMerge(apply: boolean) {
  const allMachines = await db.select().from(machines);
  const byId = new Map(allMachines.map((machine) => [machine.id, machine]));
  const validated = DUPLICATE_MACHINE_GROUPS.map((group) => ({
    ...group,
    validation: !byId.get(group.duplicateId) && byId.get(group.canonicalId)
      ? { ok: true, reason: "already merged" }
      : validateDuplicateGroup(byId.get(group.canonicalId), byId.get(group.duplicateId), group.label),
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
  const groupCounts = pendingGroups.map((group) => ({
    canonicalId: group.canonicalId,
    duplicateId: group.duplicateId,
    linksBefore: links.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    linksAfter: new Set(links.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.videoId)).size,
    mentionsBefore: mentions.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    mentionsAfter: new Set(mentions.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.videoId)).size,
    votesBefore: votes.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).length,
    votesAfter: new Set(votes.filter((row) => row.machineId === group.canonicalId || row.machineId === group.duplicateId).map((row) => row.voterFingerprint)).size,
    judgmentsToMove: judgments.filter((row) => row.machineId === group.duplicateId).length,
  }));
  const report = { groups: validated, groupCounts, linksBefore: links.length, linksAfter: groupCounts.reduce((sum, group) => sum + group.linksAfter, 0), mentionsBefore: mentions.length, mentionsAfter: groupCounts.reduce((sum, group) => sum + group.mentionsAfter, 0), votesBefore: votes.length, votesAfter: groupCounts.reduce((sum, group) => sum + group.votesAfter, 0), judgmentsBefore: judgments.length, judgmentsToMove: groupCounts.reduce((sum, group) => sum + group.judgmentsToMove, 0), applied: false };
  if (!apply) return report;

  await db.transaction(async (tx) => {
    for (const group of pendingGroups) {
      await mergeLinks(tx, group.canonicalId, group.duplicateId);
      await mergeMentions(tx, group.canonicalId, group.duplicateId);
      await mergeVotes(tx, group.canonicalId, group.duplicateId);
      await mergeJudgments(tx, group.canonicalId, group.duplicateId);
      await tx.delete(machines).where(eq(machines.id, group.duplicateId));
    }
  });
  return { ...report, applied: true };
}

if (import.meta.main) {
  const apply = process.argv.includes("--apply");
  runDuplicateMachineMerge(apply)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!apply) console.log("Dry-run only. Re-run with --apply to execute the transactional merge.");
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
