import { describe, expect, test } from "bun:test";
import { batchVideoIds, selectTrackedVideoIds } from "./video-tracking";

const now = new Date("2026-08-31T00:00:00.000Z");

describe("video tracking selection", () => {
  test("tracks active-channel videos published within 60 days", () => {
    expect(selectTrackedVideoIds([
      { videoId: "new", channelId: 1, publishedAt: "2026-08-01T00:00:00Z", updatedAt: now },
      { videoId: "old", channelId: 1, publishedAt: "2026-06-01T00:00:00Z", updatedAt: now },
      { videoId: "inactive", channelId: 2, publishedAt: "2026-08-01T00:00:00Z", updatedAt: now },
    ], new Set([1]), now)).toEqual(["new"]);
  });

  test("updates oldest records first so a limit does not starve later videos", () => {
    expect(selectTrackedVideoIds([
      { videoId: "fresh", channelId: 1, publishedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-30T00:00:00Z" },
      { videoId: "stale", channelId: 1, publishedAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-20T00:00:00Z" },
    ], new Set([1]), now, 60, 1)).toEqual(["stale"]);
  });

  test("excludes videos already fetched by new-video discovery", () => {
    expect(selectTrackedVideoIds([
      { videoId: "new", channelId: 1, publishedAt: "2026-08-01T00:00:00Z", updatedAt: now },
    ], new Set([1]), now, 60, 5000, new Set(["new"]))).toEqual([]);
  });
});

test("batches YouTube video IDs in groups of 50", () => {
  const ids = Array.from({ length: 101 }, (_, index) => `video-${index}`);
  expect(batchVideoIds(ids).map((batch) => batch.length)).toEqual([50, 50, 1]);
});
