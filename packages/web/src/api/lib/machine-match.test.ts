import { describe, expect, test } from "bun:test";
import { findDetailedMachineMatches, findMachineMatches, machineTerms } from "./machine-match";

const machines = [
  { id: 1, name: "スマスロ北斗の拳", shortName: "北斗", aliases: ["北斗の拳", "スマスロ北斗"] },
  { id: 2, name: "P海物語 極JAPAN", shortName: "海", aliases: ["極海物語JAPAN"] },
  { id: 3, name: "P/eフィーバーブルーロック Light ver.", shortName: "ブルーロック Light", aliases: ["ブルーロックLight", "Fブルーロック"] },
  { id: 4, name: "eフィーバーブルーロック", shortName: "ブルーロック", aliases: ["ブルーロック"] },
];

describe("machine title matching", () => {
  test("matches official names, short names, and aliases", () => {
    // Official name match
    const match1 = findDetailedMachineMatches("新台 スマスロ北斗の拳 実戦", machines);
    expect(match1.map((m) => m.machineId)).toEqual([1]);
    expect(match1[0].matchMethod).toBe("exact_name");
    expect(match1[0].matchConfidence).toBe(100);

    // Alias match (using "北斗の拳" which is length 4, so it's safe)
    const match2 = findDetailedMachineMatches("新台 北斗の拳を打つ", machines);
    expect(match2.map((m) => m.machineId)).toEqual([1]);
    expect(match2[0].matchMethod).toBe("alias");
    expect(match2[0].matchConfidence).toBe(85);

    // Official name matches first even if it looks like alias
    const match3 = findDetailedMachineMatches("P海物語 極JAPANを打つ", machines);
    expect(match3.map((m) => m.machineId)).toEqual([2]);
    expect(match3[0].matchMethod).toBe("exact_name");
  });

  test("filters unsafe short aliases", () => {
    expect(machineTerms(machines[1])).not.toContain("海");
    expect(findMachineMatches("今日は海へ行く", machines)).toEqual([]);
  });

  test("allows one video to match multiple machines", () => {
    // Both match (Hokuto and Umi)
    expect(findMachineMatches("スマスロ北斗とP海物語 極JAPANを比較", machines).map((machine) => machine.id)).toEqual([
      1,
      2,
    ]);
  });

  test("respects exclude terms", () => {
    const machineList = [{ id: 5, name: "P海物語 極JAPAN", shortName: "海", aliases: [], excludeTerms: ["釣り"] }];
    expect(findMachineMatches("釣りで海物語", machineList)).toEqual([]);
  });

  test("resolves overlaps by prioritizing longer matched terms (substring filtering)", () => {
    // "P/eフィーバーブルーロック Light ver." vs "eフィーバーブルーロック"
    // "P/eフィーバーブルーロック Light ver. 初打ち" matches "ブルーロック" (Machine 4) and "ブルーロックLight" (Machine 3)
    // "ブルーロックLight" (length 9) contains "ブルーロック" (length 6), so Machine 4 should be filtered out.
    const match = findDetailedMachineMatches("P/eフィーバーブルーロック Light ver. 初打ち", machines);
    expect(match.map((m) => m.machineId)).toEqual([3]); // Only Machine 3 is matched
  });

  test("normalizes full-width, half-width, spaces and casing", () => {
    // full-width spaces and English characters for "ブルーロック Light ver."
    const match = findDetailedMachineMatches("新台　ブルーロック　ｌｉｇｈｔ　ｖｅｒ．実戦", machines);
    expect(match.map((m) => m.machineId)).toEqual([3]);
  });

  test("returns empty when unmatched", () => {
    const match = findDetailedMachineMatches("無関係な動画タイトル", machines);
    expect(match).toEqual([]);
  });
});
