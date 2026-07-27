import { describe, expect, test } from "bun:test";
import {
  buildVideoMetadataBackfillUpdates,
  filterUpdatesAfterMetadataFetch,
  selectVideoMetadataRows,
} from "./video-metadata-backfill";

describe("video metadata backfill planning", () => {
  const rows = [
    { videoId: "complete-1", title: "complete", durationSeconds: 120, liveBroadcastContent: "none" },
    { videoId: "missing-duration", title: "missing duration", durationSeconds: null, liveBroadcastContent: "none" },
    { videoId: "missing-live-status", title: "missing status", durationSeconds: 120, liveBroadcastContent: null },
  ] as const;

  test("selects only incomplete rows during normal reclassification", () => {
    expect(selectVideoMetadataRows(rows, false).map((row) => row.videoId)).toEqual(["missing-duration", "missing-live-status"]);
  });

  test("selects every row when refresh metadata is enabled", () => {
    expect(selectVideoMetadataRows(rows, true).map((row) => row.videoId)).toEqual(["complete-1", "missing-duration", "missing-live-status"]);
  });

  test("does not retain updates for videos whose refresh fetch failed", () => {
    const updates = buildVideoMetadataBackfillUpdates(
      [{ videoId: "complete-1", title: "complete", durationSeconds: 120, liveBroadcastContent: "none" }],
      [],
    ).updates;

    expect(filterUpdatesAfterMetadataFetch(updates, [], true)).toEqual([]);
    expect(filterUpdatesAfterMetadataFetch(updates, [], false)).toHaveLength(1);
  });

  test("classifies fetched shorts metadata", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "short-1", title: "short practice", durationSeconds: null, liveBroadcastContent: null }],
      [{ videoId: "short-1", durationSeconds: 45, liveBroadcastContent: "none" }],
    );

    expect(result.failedVideoIds).toEqual([]);
    expect(result.updates[0]?.classification.contentType).toBe("short");
  });

  test("classifies fetched live metadata before duration", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "live-1", title: "live practice", durationSeconds: null, liveBroadcastContent: null }],
      [{ videoId: "live-1", durationSeconds: 45, liveBroadcastContent: "live" }],
    );

    expect(result.failedVideoIds).toEqual([]);
    expect(result.updates[0]?.classification.contentType).toBe("live");
  });

  test("classifies fetched long-form metadata as standard", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "standard-1", title: "long pachislot practice", durationSeconds: null, liveBroadcastContent: null }],
      [{ videoId: "standard-1", durationSeconds: 1200, liveBroadcastContent: "none" }],
    );

    expect(result.failedVideoIds).toEqual([]);
    expect(result.updates[0]?.classification.contentType).toBe("standard");
  });

  test("uses refreshed live metadata when stored fields are already populated", () => {
    const ids = ["oZ_pSSNFu0Q", "8Ok-UWWfGeo", "kcKS4gHEaIA"];
    const result = buildVideoMetadataBackfillUpdates(
      ids.map((videoId) => ({ videoId, title: "配信アーカイブ", durationSeconds: 1800, liveBroadcastContent: "none" })),
      ids.map((videoId) => ({ videoId, durationSeconds: 1800, liveBroadcastContent: "none", liveStreamingDetails: { actualStartTime: "2026-07-01T12:00:00Z" } })),
    );
    expect(result.updates).toHaveLength(3);
    expect(result.updates.every((update) => update.classification.contentType === "live")).toBe(true);
  });

  test("keeps the singing premiere standard during refresh", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "vU3FTxrbhWo", title: "【歌ってみた】乙女フェスティバル", durationSeconds: 303, liveBroadcastContent: "none" }],
      [{ videoId: "vU3FTxrbhWo", durationSeconds: 303, liveBroadcastContent: "none", liveStreamingDetails: { actualStartTime: "2026-07-01T12:00:00Z" } }],
    );
    expect(result.updates[0]?.classification.contentType).toBe("standard");
  });

  test("propagates refreshed live classification into dry-run counts and liveChanges", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "vU3FTxrbhWo", title: "生配信", durationSeconds: 120, liveBroadcastContent: "none", contentType: "standard" }],
      [{ videoId: "vU3FTxrbhWo", durationSeconds: 120, liveBroadcastContent: "none", liveStreamingDetails: { actualStartTime: "2026-07-01T12:00:00Z" } }],
    );
    const change = { before: "standard", after: result.updates[0]!.classification.contentType };
    const afterCounts: Record<string, number> = { standard: 0, short: 0, live: 0, promotion: 0, unknown: 0 };
    afterCounts[change.after] += 1;
    const liveChanges = [change].filter((item) => item.before === "live" || item.after === "live");
    expect(change).toEqual({ before: "standard", after: "live" });
    expect(afterCounts).toEqual({ standard: 0, short: 0, live: 1, promotion: 0, unknown: 0 });
    expect(liveChanges).toHaveLength(1);
  });

  test("does not downgrade an existing live video", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "already-live", title: "配信アーカイブ", durationSeconds: 1800, liveBroadcastContent: "none", contentType: "live" }],
      [{ videoId: "already-live", durationSeconds: 1800, liveBroadcastContent: "none" }],
    );

    expect(result.updates[0]?.classification.contentType).toBe("live");
  });

  test("does not classify missing metadata rows after an API failure", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "failed-1", title: "might be shorts", durationSeconds: null, liveBroadcastContent: null }],
      [],
    );

    expect(result.failedVideoIds).toEqual(["failed-1"]);
    expect(result.updates).toEqual([]);
  });
});
