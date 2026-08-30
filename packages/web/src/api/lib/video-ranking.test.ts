import { describe, expect, test } from "bun:test";
import {
  calculateVideoTrend,
  decodeVideoRankingCursor,
  encodeVideoRankingCursor,
  paginateVideoRanking,
  selectTrendingVideoEntries,
  sortVideoRankingEntries,
} from "./video-ranking";

describe("video ranking pagination", () => {
  const entries = sortVideoRankingEntries([
    { videoId: "c", currentViewCount: 1000, viewDelta: 10 },
    { videoId: "a", currentViewCount: 1000, viewDelta: 10 },
    { videoId: "b", currentViewCount: 900, viewDelta: 10 },
    { videoId: "d", currentViewCount: 2000, viewDelta: 5 },
  ]);

  test("orders ties by current views then stable video id", () => {
    expect(entries.map((entry) => entry.videoId)).toEqual(["a", "c", "b", "d"]);
  });

  test("uses ranking tuple cursors without duplicate page boundaries", () => {
    const first = paginateVideoRanking(entries, 2, null);
    expect(first.page.map((entry) => entry.videoId)).toEqual(["a", "c"]);
    const second = paginateVideoRanking(entries, 2, decodeVideoRankingCursor(first.nextCursor ?? undefined));
    expect(second.page.map((entry) => entry.videoId)).toEqual(["b", "d"]);
    expect(second.nextCursor).toBeNull();
  });

  test("continues after a stale cursor by tuple position", () => {
    const cursor = encodeVideoRankingCursor({ videoId: "missing", currentViewCount: 950, viewDelta: 10 });
    const page = paginateVideoRanking(entries, 10, decodeVideoRankingCursor(cursor));
    expect(page.page.map((entry) => entry.videoId)).toEqual(["b", "d"]);
  });

  test("does not guarantee a snapshot-consistent page if ranking values change between requests", () => {
    const first = paginateVideoRanking(entries, 2, null);
    const updatedEntries = sortVideoRankingEntries([
      { videoId: "c", currentViewCount: 1000, viewDelta: 10 },
      { videoId: "a", currentViewCount: 1000, viewDelta: 10 },
      { videoId: "b", currentViewCount: 900, viewDelta: 10 },
      { videoId: "d", currentViewCount: 2000, viewDelta: 5 },
      { videoId: "new-top", currentViewCount: 3000, viewDelta: 50 },
    ]);

    const second = paginateVideoRanking(updatedEntries, 2, decodeVideoRankingCursor(first.nextCursor ?? undefined));

    expect(first.page.map((entry) => entry.videoId)).toEqual(["a", "c"]);
    expect(second.page.map((entry) => entry.videoId)).toEqual(["b", "d"]);
    expect(second.page.some((entry) => entry.videoId === "new-top")).toBe(false);
  });
});

describe("video ranking selection", () => {
  test("keeps every content type eligible after the tab filter", () => {
    const entries = selectTrendingVideoEntries([
      { videoId: "standard", currentViewCount: 100, viewDelta: 5, contentType: "standard" },
      { videoId: "promotion", currentViewCount: 90, viewDelta: 8, contentType: "promotion" },
      { videoId: "unknown", currentViewCount: 80, viewDelta: 3, contentType: "unknown" },
      { videoId: "flat", currentViewCount: 70, viewDelta: 0, contentType: "live" },
    ]);
    expect(entries.map((entry) => entry.videoId)).toEqual(["promotion", "standard", "unknown"]);
  });
});

describe("video trend calculation", () => {
  test("uses only the latest two collected snapshots for previous mode", () => {
    expect(calculateVideoTrend([
      { date: "2026-08-30", viewCount: 1_108_064, collectedAt: "2026-08-30T01:00:00.000Z" },
      { date: "2026-08-29", viewCount: 1_100_000, collectedAt: "2026-08-29T01:00:00.000Z" },
      { date: "2026-07-16", viewCount: 773_746, collectedAt: "2026-07-16T01:00:00.000Z" },
    ], 1, "previous")).toMatchObject({
      hasTrend: true,
      viewDelta: 8_064,
      baseCollectedAt: "2026-08-29T01:00:00.000Z",
      latestCollectedAt: "2026-08-30T01:00:00.000Z",
      comparisonHours: 24,
    });
  });

  test("does not rank a video when its previous snapshot is too old", () => {
    expect(calculateVideoTrend([
      { date: "2026-08-30", viewCount: 1_108_064, collectedAt: "2026-08-30T01:00:00.000Z" },
      { date: "2026-07-16", viewCount: 773_746, collectedAt: "2026-07-16T01:00:00.000Z" },
    ], 1, "previous")).toMatchObject({ hasTrend: false, comparisonStatus: "insufficient", viewDelta: 0 });
  });

  test("uses the nearest valid snapshot to seven days before the latest", () => {
    expect(calculateVideoTrend([
      { date: "2026-08-30", viewCount: 200, collectedAt: "2026-08-30T02:00:00.000Z" },
      { date: "2026-08-23", viewCount: 100, collectedAt: "2026-08-23T02:00:00.000Z" },
      { date: "2026-08-22", viewCount: 20, collectedAt: "2026-08-22T02:00:00.000Z" },
    ], 7, "7d")).toMatchObject({ hasTrend: true, viewDelta: 100, snapshotDays: 7, comparisonHours: 168 });
  });

  test("is deterministic when the same snapshots are processed again", () => {
    const snapshots = [
      { date: "2026-08-30", viewCount: 200, collectedAt: "2026-08-30T02:00:00.000Z" },
      { date: "2026-08-29", viewCount: 100, collectedAt: "2026-08-29T02:00:00.000Z" },
    ];
    expect(calculateVideoTrend(snapshots, 1, "previous")).toEqual(calculateVideoTrend(snapshots, 1, "previous"));
  });

  test("uses the same seven-day comparison as the global ranking", () => {
    expect(calculateVideoTrend([
      { date: "2026-07-17", viewCount: 180 },
      { date: "2026-07-10", viewCount: 100 },
    ], 7)).toMatchObject({ hasTrend: true, viewDelta: 80, comparisonStatus: "ready", isProvisional: false, snapshotDays: 7 });
  });

  test("reports insufficient history without inventing a trend", () => {
    expect(calculateVideoTrend([{ date: "2026-07-17", viewCount: 180 }], 7)).toMatchObject({ hasTrend: false, viewDelta: 0, comparisonStatus: "insufficient" });
  });

  test("checks 1-day, 2-day, and 4-day intervals for daily period", () => {
    // 1-day difference: ready, isProvisional = false
    expect(calculateVideoTrend([
      { date: "2026-07-17", viewCount: 180 },
      { date: "2026-07-16", viewCount: 100 },
    ], 1)).toMatchObject({ hasTrend: true, viewDelta: 80, comparisonStatus: "ready", isProvisional: false, snapshotDays: 1 });

    // 2-day difference: ready, isProvisional = true
    expect(calculateVideoTrend([
      { date: "2026-07-17", viewCount: 180 },
      { date: "2026-07-15", viewCount: 100 },
    ], 1)).toMatchObject({ hasTrend: true, viewDelta: 80, comparisonStatus: "ready", isProvisional: true, snapshotDays: 2 });

    // 4-day difference: outside daily range limit (1..3), so insufficient
    expect(calculateVideoTrend([
      { date: "2026-07-17", viewCount: 180 },
      { date: "2026-07-13", viewCount: 100 },
    ], 1)).toMatchObject({ hasTrend: false, viewDelta: 0, comparisonStatus: "insufficient" });
  });

  test("handles zero increase (viewDelta = 0) properly", () => {
    expect(calculateVideoTrend([
      { date: "2026-07-17", viewCount: 100 },
      { date: "2026-07-16", viewCount: 100 },
    ], 1)).toMatchObject({ hasTrend: true, viewDelta: 0, comparisonStatus: "ready", isProvisional: false });
  });
});
