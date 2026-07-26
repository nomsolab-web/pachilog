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
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "archive-1", title: "\u914d\u4fe1\u30a2\u30fc\u30ab\u30a4\u30d6", durationSeconds: 1800, liveBroadcastContent: "none" }],
      [{ videoId: "archive-1", durationSeconds: 1800, liveBroadcastContent: "none", liveStreamingDetails: { actualStartTime: "2026-07-01T12:00:00Z", actualEndTime: "2026-07-01T13:00:00Z" } }],
    );

    expect(result.updates[0]?.classification.contentType).toBe("standard");
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
