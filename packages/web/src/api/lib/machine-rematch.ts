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

    return {
      videoId: video.videoId,
      matches,
      linksToAdd,
      ambiguousMachineIds: findAmbiguousMachineCandidates(video.title, machines).map((machine) => machine.id),
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
  const activeLinks = links.filter((link) => link.matchMethod !== "manual_excluded");
  const matchedVideoIds = new Set(activeLinks.map((link) => link.videoId));
  for (const decision of decisions) {
    if (decision.linksToAdd.length > 0) matchedVideoIds.add(decision.videoId);
  }
  const ambiguousVideoIds = new Set(
    decisions
      .filter((decision) => decision.matches.length === 0 && decision.ambiguousMachineIds.length > 0)
      .map((decision) => decision.videoId),
  );

  return {
    totalVideos: videos.length,
    matched: videos.filter((video) => matchedVideoIds.has(video.videoId)).length,
    ambiguous: ambiguousVideoIds.size,
    unmatched: videos.filter((video) => !matchedVideoIds.has(video.videoId) && !ambiguousVideoIds.has(video.videoId)).length,
    existingLinkCount: links.length,
    linksToAdd: decisions.reduce((count, decision) => count + decision.linksToAdd.length, 0),
    manualExcludedPreserved: links.filter((link) => link.matchMethod === "manual_excluded").length,
  };
}
