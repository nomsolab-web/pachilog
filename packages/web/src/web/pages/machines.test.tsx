import { describe, expect, test } from "bun:test";
import { countMachineTypes, filterMachineList, normalizeMachineList } from "./machines";

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
