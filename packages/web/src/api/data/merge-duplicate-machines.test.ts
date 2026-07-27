import { describe, expect, test } from "bun:test";
import { mergeUniqueMachineRows, preferredLink, validateDuplicateGroup } from "./merge-duplicate-machines";

const base = {
  id: 1,
  name: "eフィーバー デッドマウント・デスプレイ 魂神9000",
  maker: "SANKYO",
  type: "pachinko",
  releaseDate: "2026-06-08",
  series: null,
} as any;

describe("duplicate machine merge planning", () => {
  test("confirms the known short-name duplicate but rejects a different spec", () => {
    expect(validateDuplicateGroup(base, { ...base, id: 2, name: "eフィーバー デッドマウント・デスプレイ 魂神" }, "デッドマウントデスプレイ").ok).toBe(true);
    expect(validateDuplicateGroup(base, { ...base, id: 2, name: "eフィーバー デッドマウント・デスプレイ 魂神8000" }, "デッドマウントデスプレイ").ok).toBe(false);
  });

  test("deduplicates a video link while preserving union rows", () => {
    const result = mergeUniqueMachineRows(
      [
        { id: 1, machineId: 8, videoId: "video-a" },
        { id: 2, machineId: 5, videoId: "video-a" },
        { id: 3, machineId: 5, videoId: "video-b" },
      ],
      8,
      5,
      (row) => row.videoId,
    );
    expect(result.rows.map((row) => [row.machineId, row.videoId])).toEqual([[8, "video-a"], [8, "video-b"]]);
    expect(result.removedIds).toEqual([2]);
  });

  test("prefers manual protection when duplicate links conflict", () => {
    const auto = { machineId: 8, videoId: "v", matchMethod: "alias", matchConfidence: 85 } as any;
    const excluded = { machineId: 5, videoId: "v", matchMethod: "manual_excluded", matchConfidence: 0 } as any;
    expect(preferredLink(auto, excluded).matchMethod).toBe("manual_excluded");
  });
});
