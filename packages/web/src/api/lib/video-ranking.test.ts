import { describe, expect, test } from "bun:test";
import {
  decodeVideoRankingCursor,
  encodeVideoRankingCursor,
  paginateVideoRanking,
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
});
