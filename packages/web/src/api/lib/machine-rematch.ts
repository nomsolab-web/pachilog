import {
  findAmbiguousMachineCandidates,
  findDetailedMachineMatches,
  type MachineMatchResult,
} from "./machine-match";

export type RematchMachine = {
  id: number;
  name: string;
  shortName?: string | null;
  aliases?: string[] | null;
  excludeTerms?: string[] | null;
  uniqueAliases?: string[] | null;
  ambiguousAliases?: string[] | null;
  resolvingKeywords?: string[] | null;
};

export type RematchVideo = {
  videoId: string;
  title: string;
  matchStatus: string;
};

export type PlannedMatchStatus = "matched" | "ambiguous" | "unmatched" | "manual" | "manual_excluded";

export type RematchLink = {
  videoId: string;
  machineId: number;
  matchConfidence: number;
  matchMethod: string;
};

export type RematchDecision = {
  videoId: string;
  matches: MachineMatchResult[];
  linksToAdd: MachineMatchResult[];
  ambiguousMachineIds: number[];
  plannedMatchStatus: PlannedMatchStatus;
  preserveManualLinkCount: number;
  preservedAutoLinkCount: number;
};

export function planMachineRematch(
  videos: readonly RematchVideo[],
  machines: readonly RematchMachine[],
  links: readonly RematchLink[],
): RematchDecision[] {
  return videos.map((video) => {
    const existing = links.filter((link) => link.videoId === video.videoId);
    const protectedMachineIds = new Set(
      existing
        .filter((link) => link.matchMethod === "manual" || link.matchMethod === "manual_excluded")
        .map((link) => link.machineId),
    );
    const existingAutoMachineIds = new Set(
      existing
        .filter((link) => link.matchMethod !== "manual" && link.matchMethod !== "manual_excluded")
        .map((link) => link.machineId),
    );
    const matches = findDetailedMachineMatches(video.title, machines);
    const linksToAdd = matches.filter(
      (match) => !protectedMachineIds.has(match.machineId) && !existingAutoMachineIds.has(match.machineId),
    );

    const hasActiveLink = existing.some((link) => link.matchMethod !== "manual_excluded");
    const ambiguousMachineIds = findAmbiguousMachineCandidates(video.title, machines).map((machine) => machine.id);
    const plannedMatchStatus: PlannedMatchStatus =
      video.matchStatus === "manual" || video.matchStatus === "manual_excluded"
        ? video.matchStatus
        : hasActiveLink || linksToAdd.length > 0
          ? "matched"
          : ambiguousMachineIds.length > 0 ? "ambiguous" : "unmatched";

    return {
      videoId: video.videoId,
      matches,
      linksToAdd,
      ambiguousMachineIds,
      plannedMatchStatus,
      preserveManualLinkCount: existing.filter(
        (link) => link.matchMethod === "manual" || link.matchMethod === "manual_excluded",
      ).length,
      preservedAutoLinkCount: existingAutoMachineIds.size,
    };
  });
}

export function summarizeMachineRematch(
  videos: readonly RematchVideo[],
  links: readonly RematchLink[],
  decisions: readonly RematchDecision[],
) {
  return {
    totalVideos: videos.length,
    matched: decisions.filter((decision) => decision.plannedMatchStatus === "matched").length,
    ambiguous: decisions.filter((decision) => decision.plannedMatchStatus === "ambiguous").length,
    unmatched: decisions.filter((decision) => decision.plannedMatchStatus === "unmatched").length,
    existingLinkCount: links.length,
    linksToAdd: decisions.reduce((count, decision) => count + decision.linksToAdd.length, 0),
    manualExcludedPreserved: links.filter((link) => link.matchMethod === "manual_excluded").length,
  };
}
