import { describe, expect, test } from "bun:test";
import {
  INITIAL_MACHINE_LIMIT,
  averageRecentViewsPerVideo,
  countMachineTypes,
  expandedMachineLimit,
  filterMachineList,
  isReferenceMachine,
  normalizeMachineList,
  resetMachineVisibleCount,
  splitMachinesByRankingEligibility,
  visibleRankedMachines,
} from "./machines";

const rows = [
  { id: 1, name: "P machine", type: "pachinko", releaseDate: "2026-04-06" },
  { id: 2, name: "L machine", type: "pachislot", releaseDate: "2026-04-06" },
  { id: 3, name: "Legacy slot", type: "パチスロ", releaseDate: "2026-05-11" },
  { id: 4, name: "Unknown", type: null, releaseDate: "2026-04-06" },
];

describe("machine list type filters", () => {
  test("normalizes values before filtering and labels", () => {
    const normalized = normalizeMachineList(rows);
    expect(normalized.map((row) => row.type)).toEqual(["pachinko", "slot", "slot", null]);
    expect(filterMachineList(rows, "pachinko", "all").map((row) => row.id)).toEqual([1]);
    expect(filterMachineList(rows, "slot", "all").map((row) => row.id)).toEqual([2, 3]);
  });

  test("combines type and release month without treating unknown as slot", () => {
    expect(filterMachineList(rows, "slot", "2026-04").map((row) => row.id)).toEqual([2]);
    expect(filterMachineList(rows, "all", "2026-04").map((row) => row.id)).toEqual([1, 2, 4]);
    expect(filterMachineList(rows, "slot", "2026-06")).toEqual([]);
  });

  test("counts all rows separately from canonical type counts", () => {
    expect(countMachineTypes(rows)).toEqual({ pachinko: 1, slot: 2, unknown: 1 });
  });
});

describe("machine ranking presentation helpers", () => {
  const rankingRows = [
    { id: 1, videoCount: 3, recentViews: 300, channelCount: 2 },
    { id: 2, videoCount: 0, recentViews: 0, channelCount: 0 },
    { id: 3, videoCount: 1, recentViews: 99, channelCount: 1 },
    { id: 4, videoCount: 2, recentViews: 101, channelCount: 1 },
  ];

  test("separates zero-video machines so they do not receive ranking positions", () => {
    const result = splitMachinesByRankingEligibility(rankingRows);
    expect(result.ranked.map((row) => row.id)).toEqual([1, 3, 4]);
    expect(result.unranked.map((row) => row.id)).toEqual([2]);
  });

  test("marks one- and two-video machines as reference values only", () => {
    expect(isReferenceMachine({ id: 1, videoCount: 1 })).toBe(true);
    expect(isReferenceMachine({ id: 2, videoCount: 2 })).toBe(true);
    expect(isReferenceMachine({ id: 3, videoCount: 3 })).toBe(false);
    expect(isReferenceMachine({ id: 4, videoCount: 0 })).toBe(false);
  });

  test("calculates average recent views per video without dividing by zero", () => {
    expect(averageRecentViewsPerVideo({ id: 1, videoCount: 2, recentViews: 101 })).toBe(51);
    expect(averageRecentViewsPerVideo({ id: 2, videoCount: 0, recentViews: 100 })).toBe(0);
    expect(averageRecentViewsPerVideo({ id: 3, videoCount: null, recentViews: 100 })).toBe(0);
  });

  test("limits initial ranking rows and expands with more while filters reset the limit", () => {
    const items = Array.from({ length: 45 }, (_, index) => ({ id: index + 1 }));
    expect(visibleRankedMachines(items, INITIAL_MACHINE_LIMIT)).toHaveLength(20);
    expect(expandedMachineLimit(INITIAL_MACHINE_LIMIT, items.length)).toBe(40);
    expect(expandedMachineLimit(40, items.length)).toBe(45);
    expect(resetMachineVisibleCount()).toBe(INITIAL_MACHINE_LIMIT);
  });
});
