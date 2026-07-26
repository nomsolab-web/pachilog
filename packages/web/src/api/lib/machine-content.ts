import type { VideoContentType } from "./content-type";

export type MachineLinkedVideo = {
  videoId: string;
  matchMethod: string;
  contentType: VideoContentType;
  matchStatus?: string | null;
};

export const CONFIRMED_MATCH_STATUS = "matched" as const;
export const EXCLUDED_MACHINE_LINK_METHOD = "manual_excluded" as const;

export function isConfirmedMachineLink(row: Pick<MachineLinkedVideo, "matchMethod" | "matchStatus">) {
  return row.matchStatus === CONFIRMED_MATCH_STATUS && row.matchMethod !== EXCLUDED_MACHINE_LINK_METHOD;
}

export function excludeManualExcludedLinks<T extends MachineLinkedVideo>(rows: readonly T[]) {
  return rows.filter(isConfirmedMachineLink);
}

export const selectConfirmedMachineVideos = excludeManualExcludedLinks;

export function countMachineContentTypes(rows: readonly { contentType: VideoContentType }[]) {
  const counts: Record<VideoContentType, number> = { standard: 0, short: 0, live: 0, promotion: 0, unknown: 0 };
  const seen = new Set<string>();
  for (const row of rows) {
    const key = "videoId" in row && typeof row.videoId === "string" ? row.videoId : `${seen.size}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[row.contentType] += 1;
  }
  return counts;
}
