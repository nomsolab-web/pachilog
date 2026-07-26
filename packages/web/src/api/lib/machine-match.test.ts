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

  test("matches official name, shortName, and uniqueAlias with expected ids and methods", () => {
    const machines = [
      { id: 10, name: "P Dragon Quest 12", shortName: "Dragon Quest 12" },
      { id: 11, name: "P Official Machine Beta", uniqueAliases: ["Beta Special"] },
    ];
    expect(findDetailedMachineMatches("P Dragon Quest 12 実戦", machines)).toMatchObject([
      { machineId: 10, matchMethod: "exact_name" },
    ]);
    expect(findDetailedMachineMatches("Dragon Quest 12 実戦", machines)).toMatchObject([
      { machineId: 10, matchMethod: "alias" },
    ]);
    expect(findDetailedMachineMatches("Beta Special 実戦", machines)).toMatchObject([
      { machineId: 11, matchMethod: "alias" },
    ]);
  });

  test("requires resolvingKeyword for ambiguousAlias and rejects a general word alone", () => {
    const machines = [{ id: 12, name: "P Resolving Machine", ambiguousAliases: ["popular machine"], resolvingKeywords: ["resolving machine"] }];
    expect(findDetailedMachineMatches("popular machine 実戦", machines)).toEqual([]);
    expect(findDetailedMachineMatches("popular machine resolving machine", machines)).toMatchObject([
      { machineId: 12, matchMethod: "alias" },
    ]);
  });

  test("keeps specification variants separate and prefers the longer machine name", () => {
    const machines = [
      { id: 13, name: "P Ocean 5" },
      { id: 14, name: "P Ocean 5 Special" },
    ];
    expect(findDetailedMachineMatches("P Ocean 5 Special 実戦", machines).map((match) => match.machineId)).toEqual([14]);
  });

  test("keeps one highest-confidence match when alias categories overlap", () => {
    const machines = [{
      id: 15,
      name: "P Machine A",
      uniqueAliases: ["Machine A Light"],
      ambiguousAliases: ["popular machine"],
      resolvingKeywords: ["Machine A"],
    }];
    const matches = findDetailedMachineMatches("Machine A Light popular machine Machine A 螳滓姶", machines);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ machineId: 15, matchMethod: "alias", matchConfidence: 85 });
  });
});
