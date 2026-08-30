export type VideoRankingEntry = {
  videoId: string;
  currentViewCount: number;
  viewDelta: number;
};

export function selectTrendingVideoEntries<T extends VideoRankingEntry>(entries: readonly T[]) {
  return sortVideoRankingEntries(entries.filter((entry) => entry.viewDelta > 0));
}

export type VideoSnapshotForRanking = { date: string; viewCount: number; collectedAt?: Date | string | number | null };

export type VideoComparisonMode = "previous" | "7d";

const MAX_PREVIOUS_GAP_HOURS = 72;
const MIN_SEVEN_DAY_GAP_DAYS = 5;
const MAX_SEVEN_DAY_GAP_DAYS = 9;
const DEFAULT_MAX_LATEST_AGE_HOURS = 72;

export type VideoTrendOptions = {
  referenceCollectedAt?: Date | string | number | null;
  maxLatestAgeHours?: number;
};

export function calculateVideoTrend(
  snapshots: readonly VideoSnapshotForRanking[],
  period: number,
  mode: VideoComparisonMode = period === 7 ? "7d" : "previous",
  options: VideoTrendOptions = {},
) {
  const comparison = selectVideoComparisonSnapshots(snapshots, mode, options);
  const hasTrend = !!comparison.latest && !!comparison.base && comparison.status === "ready";
  const viewDelta = hasTrend ? comparison.latest!.viewCount - comparison.base!.viewCount : 0;
  const viewDeltaPct = hasTrend && comparison.base!.viewCount > 0 ? (viewDelta / comparison.base!.viewCount) * 100 : 0;
  return {
    latestDate: comparison.latest?.date ?? null,
    baseDate: hasTrend ? comparison.base?.date ?? null : null,
    latestViewCount: comparison.latest?.viewCount ?? null,
    latestCollectedAt: comparison.latest ? toIsoString(comparison.latest.collectedAt) : null,
    baseCollectedAt: hasTrend ? toIsoString(comparison.base?.collectedAt) : null,
    referenceCollectedAt: toIsoString(options.referenceCollectedAt),
    latestAgeHours: comparison.latestAgeHours,
    comparisonHours: hasTrend ? comparison.comparisonHours : 0,
    snapshotDays: comparison.comparisonDays,
    comparisonStatus: comparison.status,
    comparisonStartDate: comparison.comparisonStartDate,
    comparisonEndDate: comparison.comparisonEndDate,
    isProvisional: comparison.isProvisional,
    hasTrend,
    viewDelta,
    viewDeltaPct: Number(viewDeltaPct.toFixed(2)),
  };
}

export function selectVideoComparisonSnapshots(
  snapshots: readonly VideoSnapshotForRanking[],
  mode: VideoComparisonMode,
  options: VideoTrendOptions = {},
) {
  const valid = snapshots
    .filter((snapshot) => Number.isFinite(snapshot.viewCount) && snapshot.viewCount >= 0)
    .sort((a, b) => snapshotTime(b) - snapshotTime(a) || b.date.localeCompare(a.date));
  const latest = valid[0] ?? null;
  if (!latest) return insufficientVideoComparison(null, null);

  const referenceTime = toTimestamp(options.referenceCollectedAt);
  const latestTime = snapshotTime(latest);
  const latestAgeHours = referenceTime === null ? null : Math.round((referenceTime - latestTime) / (60 * 60 * 1000));
  if (latestAgeHours !== null && (latestAgeHours < 0 || latestAgeHours > (options.maxLatestAgeHours ?? DEFAULT_MAX_LATEST_AGE_HOURS))) {
    return insufficientVideoComparison(latest, null, 0, latestAgeHours);
  }

  if (mode === "previous") {
    const base = valid[1] ?? null;
    if (!base) return insufficientVideoComparison(latest, null);
    const comparisonHours = hoursBetween(base, latest);
    if (comparisonHours <= 0 || comparisonHours > MAX_PREVIOUS_GAP_HOURS) {
      return insufficientVideoComparison(latest, base, comparisonHours, latestAgeHours);
    }
    return readyVideoComparison(latest, base, comparisonHours, 1, latestAgeHours);
  }

  const target = snapshotTime(latest) - 7 * 24 * 60 * 60 * 1000;
  const base = valid
    .slice(1)
    .sort((a, b) => Math.abs(snapshotTime(a) - target) - Math.abs(snapshotTime(b) - target))[0] ?? null;
  if (!base) return insufficientVideoComparison(latest, null);
  const comparisonHours = hoursBetween(base, latest);
  const comparisonDays = comparisonHours / 24;
  if (comparisonDays < MIN_SEVEN_DAY_GAP_DAYS || comparisonDays > MAX_SEVEN_DAY_GAP_DAYS) {
    return insufficientVideoComparison(latest, base, comparisonHours, latestAgeHours);
  }
  return readyVideoComparison(latest, base, comparisonHours, 7, latestAgeHours);
}

function readyVideoComparison(latest: VideoSnapshotForRanking, base: VideoSnapshotForRanking, comparisonHours: number, expectedDays: number, latestAgeHours: number | null) {
  const comparisonDays = Math.round(comparisonHours / 24);
  return {
    latest,
    base,
    comparisonHours,
    latestAgeHours,
    comparisonDays,
    comparisonStartDate: base.date,
    comparisonEndDate: latest.date,
    status: "ready" as const,
    isProvisional: comparisonDays !== expectedDays,
  };
}

function insufficientVideoComparison(
  latest: VideoSnapshotForRanking | null,
  base: VideoSnapshotForRanking | null,
  comparisonHours = 0,
  latestAgeHours: number | null = null,
) {
  return {
    latest,
    base: null,
    comparisonHours,
    latestAgeHours,
    comparisonDays: 0,
    comparisonStartDate: null,
    comparisonEndDate: latest?.date ?? null,
    status: "insufficient" as const,
    isProvisional: false,
  };
}

function snapshotTime(snapshot: VideoSnapshotForRanking) {
  if (snapshot.collectedAt !== null && snapshot.collectedAt !== undefined) {
    const time = snapshot.collectedAt instanceof Date
      ? snapshot.collectedAt.getTime()
      : new Date(snapshot.collectedAt).getTime();
    // Test fixtures and legacy rows may contain epoch zero instead of a real
    // collection timestamp; use the daily snapshot date in that case.
    if (Number.isFinite(time) && time > 0) return time;
  }
  return new Date(`${snapshot.date}T00:00:00.000Z`).getTime();
}

function hoursBetween(older: VideoSnapshotForRanking, newer: VideoSnapshotForRanking) {
  return Math.round((snapshotTime(newer) - snapshotTime(older)) / (60 * 60 * 1000));
}

function toIsoString(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function toTimestamp(value: Date | string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

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
  const last = page[page.length - 1];
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
