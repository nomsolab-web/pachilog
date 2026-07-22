export type MachineReleaseTabId = "postRelease7" | "postReleaseAfter" | "preRelease" | "unclassified";

export type MachineReleaseTab<T> = {
  id: MachineReleaseTabId;
  label: string;
  count: number;
  data: T[];
};

export type MachineVideoForGrouping = {
  publishedAt: string | null;
};

export function groupMachineVideosByRelease<T extends MachineVideoForGrouping>(mentions: readonly T[], releaseDate: string | null | undefined) {
  const preRelease: T[] = [];
  const postRelease7: T[] = [];
  const postReleaseAfter: T[] = [];
  const unclassified: T[] = [];

  if (!releaseDate) {
    return { preRelease, postRelease7, postReleaseAfter, unclassified: [...mentions] };
  }

  const relTime = new Date(releaseDate).getTime();
  if (Number.isNaN(relTime)) {
    return { preRelease, postRelease7, postReleaseAfter, unclassified: [...mentions] };
  }

  const relTimePlus7 = relTime + 7 * 24 * 60 * 60 * 1000;

  for (const video of mentions) {
    if (!video.publishedAt) {
      unclassified.push(video);
      continue;
    }
    const pubTime = new Date(video.publishedAt).getTime();
    if (Number.isNaN(pubTime)) {
      unclassified.push(video);
      continue;
    }

    if (pubTime < relTime) {
      preRelease.push(video);
    } else if (pubTime <= relTimePlus7) {
      postRelease7.push(video);
    } else {
      postReleaseAfter.push(video);
    }
  }

  return { preRelease, postRelease7, postReleaseAfter, unclassified };
}

export function firstNonEmptyMachineReleaseTabId<T>(tabs: readonly MachineReleaseTab<T>[]) {
  return tabs.find((tab) => tab.count > 0)?.id ?? "postRelease7";
}

export function nextMachineReleaseTabAfterContentTypeChange<T>(
  tabs: readonly MachineReleaseTab<T>[],
  currentTab: MachineReleaseTabId,
  didContentTypeChange: boolean,
) {
  if (didContentTypeChange) return firstNonEmptyMachineReleaseTabId(tabs);
  return tabs.some((tab) => tab.id === currentTab) ? currentTab : firstNonEmptyMachineReleaseTabId(tabs);
}
