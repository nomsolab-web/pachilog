import { describe, expect, test } from "bun:test";
import { buildVideoMetadataBackfillUpdates } from "./video-metadata-backfill";

describe("video metadata backfill planning", () => {
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

  test("does not classify missing metadata rows after an API failure", () => {
    const result = buildVideoMetadataBackfillUpdates(
      [{ videoId: "failed-1", title: "might be shorts", durationSeconds: null, liveBroadcastContent: null }],
      [],
    );

    expect(result.failedVideoIds).toEqual(["failed-1"]);
    expect(result.updates).toEqual([]);
  });
});
