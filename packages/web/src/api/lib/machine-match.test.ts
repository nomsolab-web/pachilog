import { describe, expect, test } from "bun:test";
import { findAmbiguousMachineCandidates, findMachineMatches, machineTerms } from "./machine-match";

const machines = [
  { id: 1, name: "スマスロ北斗の拳", shortName: "北斗", aliases: ["北斗の拳", "スマスロ北斗"] },
  { id: 2, name: "P海物語 極JAPAN", shortName: "海", aliases: ["海物語"] },
];

describe("machine title matching", () => {
  test("matches official names, short names, and aliases", () => {
    expect(findMachineMatches("新台 スマスロ北斗 実戦", machines).map((machine) => machine.id)).toEqual([1]);
    expect(findMachineMatches("P海物語 極JAPANを打つ", machines).map((machine) => machine.id)).toEqual([2]);
  });

  test("filters unsafe short aliases", () => {
    expect(machineTerms(machines[1])).not.toContain("海");
    expect(findMachineMatches("今日は海へ行く", machines)).toEqual([]);
  });

  test("allows one video to match multiple machines", () => {
    expect(findMachineMatches("スマスロ北斗とP海物語 極JAPANを比較", machines).map((machine) => machine.id)).toEqual([
      1,
      2,
    ]);
  });

  test("respects exclude terms and finds ambiguous candidates separately", () => {
    const machineList = [{ id: 3, name: "P海物語 極JAPAN", shortName: "海", aliases: [], excludeTerms: ["釣り"] }];
    expect(findMachineMatches("釣りで海物語", machineList)).toEqual([]);
    expect(findAmbiguousMachineCandidates("極JAPANを試す", machineList).map((machine) => machine.id)).toEqual([3]);
  });
});
