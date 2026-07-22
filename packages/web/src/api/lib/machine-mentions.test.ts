import { describe, expect, test } from "bun:test";
import { shouldSyncMachineMention } from "./machine-mentions";

describe("machine mention synchronization", () => {
  test("detects stat-only changes even when machine links are unchanged", () => {
    expect(
      shouldSyncMachineMention(
        { videoTitle: "スマスロ実践", viewCount: 100, likeCount: 10, commentCount: 1, publishedAt: "2026-07-20T00:00:00Z" },
        { videoTitle: "スマスロ実践", viewCount: 150, likeCount: 10, commentCount: 1, publishedAt: "2026-07-20T00:00:00Z" },
      ),
    ).toBe(true);
  });

  test("does not request writes when cached mention stats already match", () => {
    expect(
      shouldSyncMachineMention(
        { videoTitle: "スマスロ実践", viewCount: 100, likeCount: 10, commentCount: 1, publishedAt: "2026-07-20T00:00:00Z" },
        { videoTitle: "スマスロ実践", viewCount: 100, likeCount: 10, commentCount: 1, publishedAt: "2026-07-20T00:00:00Z" },
      ),
    ).toBe(false);
  });
});
