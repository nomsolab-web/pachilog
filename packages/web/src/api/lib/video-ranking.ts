export type VideoRankingEntry = {
  videoId: string;
  currentViewCount: number;
  viewDelta: number;
};

export type VideoRankingCursor = {
  viewDelta: number;
  currentViewCount: number;
  videoId: string;
};

export function sortVideoRankingEntries<T extends VideoRankingEntry>(entries: readonly T[]) {
  return [...entries].sort(
    (a, b) =>
      b.viewDelta - a.viewDelta ||
      b.currentViewCount - a.currentViewCount ||
      a.videoId.localeCompare(b.videoId),
  );
}

export function encodeVideoRankingCursor(entry: VideoRankingEntry) {
  return Buffer.from(
    JSON.stringify({
      viewDelta: entry.viewDelta,
      currentViewCount: entry.currentViewCount,
      videoId: entry.videoId,
    } satisfies VideoRankingCursor),
    "utf8",
  ).toString("base64url");
}

export function decodeVideoRankingCursor(value: string | undefined): VideoRankingCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed.viewDelta !== "number" ||
      typeof parsed.currentViewCount !== "number" ||
      typeof parsed.videoId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function paginateVideoRanking<T extends VideoRankingEntry>(
  rankedEntries: readonly T[],
  limit: number,
  cursor: VideoRankingCursor | null,
) {
  const startIndex = cursor ? rankedEntries.findIndex((entry) => compareEntryToCursor(entry, cursor) > 0) : 0;
  const safeStartIndex = startIndex >= 0 ? startIndex : rankedEntries.length;
  const page = rankedEntries.slice(safeStartIndex, safeStartIndex + limit);
  const last = page.at(-1);
  return {
    page,
    nextCursor:
      page.length === limit && safeStartIndex + limit < rankedEntries.length && last
        ? encodeVideoRankingCursor(last)
        : null,
  };
}

function compareEntryToCursor(entry: VideoRankingEntry, cursor: VideoRankingCursor) {
  if (entry.viewDelta !== cursor.viewDelta) return cursor.viewDelta - entry.viewDelta;
  if (entry.currentViewCount !== cursor.currentViewCount) return cursor.currentViewCount - entry.currentViewCount;
  return entry.videoId.localeCompare(cursor.videoId);
}
