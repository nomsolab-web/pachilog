import { describe, expect, test } from "./bun-test-mock.js";
import { findDetailedMachineMatches, findAmbiguousDetailedMatches } from "./machine-match.js";

const testMachines = [
  {
    id: 1,
    name: "スマスロ北斗の拳",
    shortName: "スマスロ北斗",
    uniqueAliases: ["スマスロ北斗", "スマスロ北斗の拳", "L北斗の拳", "L北斗"],
    ambiguousAliases: ["北斗の拳"],
    resolvingKeywords: ["スマスロ", "本前兆", "無双転生"],
    excludeTerms: ["北斗転生2", "転生の章2", "北斗転生の章2"],
  },
  {
    id: 2,
    name: "スマスロ 北斗の拳 転生の章2",
    shortName: "北斗転生2",
    uniqueAliases: ["スマスロ北斗の拳 転生の章2", "北斗の拳 転生の章2", "北斗転生2", "転生の章2", "北斗転生の章2"],
    ambiguousAliases: ["北斗の拳"],
    resolvingKeywords: ["転生2", "闘神演舞"],
    excludeTerms: ["宿命"],
  },
  {
    id: 3,
    name: "P大海物語5",
    shortName: "大海5",
    uniqueAliases: ["大海物語5", "大海5"],
    ambiguousAliases: ["大海", "大海物語"],
    resolvingKeywords: ["5"],
    excludeTerms: ["大海物語4", "大海4", "大海5ブラック", "大海ブラック", "大海5スペシャル", "大海スペシャル"],
  },
  {
    id: 4,
    name: "P大海物語5スペシャル",
    shortName: "大海5SP",
    uniqueAliases: ["大海物語5スペシャル", "大海5スペシャル", "大海5SP", "大海物語5SP"],
    ambiguousAliases: ["大海", "大海物語"],
    resolvingKeywords: ["スペシャル", "SP"],
    excludeTerms: ["大海物語4", "大海4", "大海5ブラック", "大海ブラック"],
  },
  {
    id: 5,
    name: "パチスロ からくりサーカス",
    shortName: "からくりサーカス",
    uniqueAliases: ["スマスロからくりサーカス", "Lからくりサーカス"],
    ambiguousAliases: ["からくりサーカス", "からくり"],
    resolvingKeywords: ["鳴海", "しろがね"],
    excludeTerms: ["からくりサーカス2", "からくり2"],
  },
  {
    id: 6,
    name: "Lパチスロ からくりサーカス2",
    shortName: "からくり2",
    uniqueAliases: ["からくりサーカス2", "からくり2", "Lからくりサーカス2"],
    ambiguousAliases: ["からくりサーカス", "からくり"],
    resolvingKeywords: ["2"],
    excludeTerms: [],
  }
];

describe("machine title matching", () => {
  test("matches unique aliases and exact names", () => {
    // Exact name match
    const match1 = findDetailedMachineMatches("スマスロ北斗の拳を初打ち！", testMachines);
    expect(match1.map((m) => m.machineId)).toEqual([1]);
    expect(match1[0].matchMethod).toBe("exact_name");

    // Unique alias match
    const match2 = findDetailedMachineMatches("L北斗の実践動画", testMachines);
    expect(match2.map((m) => m.machineId)).toEqual([1]);
    expect(match2[0].matchMethod).toBe("alias");
  });

  test("matches ambiguous aliases only with resolving keywords", () => {
    // "北斗の拳" is ambiguous, requires resolvingKeywords (e.g. "スマスロ")
    const match1 = findDetailedMachineMatches("北斗の拳の動画", testMachines);
    expect(match1).toEqual([]); // No match (resolving keyword missing)

    const match2 = findDetailedMachineMatches("スマスロ北斗の拳を打つ", testMachines);
    expect(match2.map((m) => m.machineId)).toEqual([1]);
  });

  test("returns ambiguous candidate when resolving keyword is missing", () => {
    const amb = findAmbiguousDetailedMatches("北斗の拳の動画", testMachines);
    expect(amb.map((a) => a.machineId)).toEqual([1, 2]);
  });

  test("respects negative keywords (excludeTerms / competingMachines) for ambiguous aliases", () => {
    // "北斗の拳" (ambiguous) + "無双転生" (resolving of Machine 1) + "北斗転生2" (competing word of Machine 1)
    const match = findDetailedMachineMatches("北斗の拳の無双転生と北斗転生2の動画", testMachines);
    // Machine 1 should be excluded by negative keyword "北斗転生2"
    // Machine 2 matches because "北斗転生2" contains resolving keyword "転生2"
    expect(match.map((m) => m.machineId)).toEqual([2]);
  });

  test("Cross-machine Substring Overlap resolution (longest match priority)", () => {
    // "大海5スペシャル" matches "大海5" (Machine 3) and "大海5スペシャル" (Machine 4).
    // Range of "大海5" [0, 3] is fully contained in range of "大海5スペシャル" [0, 8].
    // So "大海5" (Machine 3) must be discarded, only "大海5スペシャル" (Machine 4) remains.
    const match1 = findDetailedMachineMatches("大海5スペシャルを打ってみた", testMachines);
    expect(match1.map((m) => m.machineId)).toEqual([4]);

    // "からくりサーカス2" -> matches "からくりサーカス2" (Machine 6) but contains "からくりサーカス" (Machine 5).
    // Must only match Machine 6.
    const match2 = findDetailedMachineMatches("からくりサーカス2の新台紹介", testMachines);
    expect(match2.map((m) => m.machineId)).toEqual([6]);
  });

  test("preserves independent matches at different positions (no substring overlap nesting)", () => {
    // "旧スマスロ北斗の拳と北斗転生2を比較" contains:
    // - "北斗の拳" at index 3 -> matches Machine 1 (resolving keyword "スマスロ" matched at index 1)
    // - "北斗転生2" at index 9 -> matches Machine 2
    // Since the matched range of Machine 1 is NOT enclosed, both are preserved.
    const match1 = findDetailedMachineMatches("旧スマスロ北斗の拳と北斗転生2を比較してみた", testMachines);
    expect(match1.map((m) => m.machineId).sort()).toEqual([1, 2]);

    // "大海5対大海5スペシャル"
    const match2 = findDetailedMachineMatches("大海5対大海5スペシャル", testMachines);
    expect(match2.map((m) => m.machineId).sort()).toEqual([3, 4]);
  });

  test("prevents My Juggler V false positive on other Juggler machines", () => {
    // Title with Funky Juggler 2, I'm Juggler EX, Happy Juggler VIII, Hokuto, and Eva
    // Must match Hokuto (Machine 1) but MUST NOT match My Juggler V (or any other Juggler)
    const title = "【初ホールの並び狙いで高設定確信！？】パチスロ実戦塾 41話【ファンキージャグラー2/アイムジャグラーEX/ハッピージャグラーVIII/スマスロ北斗の拳/LBパチスロヱヴァンゲリヲン約束の扉】";
    const matches = findDetailedMachineMatches(title, testMachines);
    expect(matches.map((m) => m.machineId)).toEqual([1]);
  });
});
