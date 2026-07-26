import { describe, expect, test } from "bun:test";
import { planMachineRematch, summarizeMachineRematch } from "./machine-rematch";

const machines = [
  { id: 1, name: "P機種A名称", shortName: "機種A名称", uniqueAliases: ["機種Aライト"] },
  { id: 2, name: "P機種B", ambiguousAliases: ["人気機種"], resolvingKeywords: ["機種B"] },
];

describe("machine rematch planning", () => {
  test("protects manual and manual_excluded links and remains idempotent", () => {
    const videos = [{ videoId: "v1", title: "機種A 実戦 機種B", matchStatus: "matched" }];
    const links = [
      { videoId: "v1", machineId: 1, matchConfidence: 100, matchMethod: "manual" },
      { videoId: "v1", machineId: 2, matchConfidence: 0, matchMethod: "manual_excluded" },
    ];
    const first = planMachineRematch(videos, machines, links);
    expect(first[0].linksToAdd).toEqual([]);
    expect(first[0].preserveManualLinkCount).toBe(2);
    const second = planMachineRematch(videos, machines, [...links]);
    expect(second[0].linksToAdd).toEqual(first[0].linksToAdd);
  });

  test("adds multiple matches without duplicating existing auto links", () => {
    const videos = [{ videoId: "v2", title: "機種A名称 機種B 機種B", matchStatus: "unmatched" }];
    const existing = [{ videoId: "v2", machineId: 1, matchConfidence: 100, matchMethod: "exact_name" }];
    const decision = planMachineRematch(videos, machines, existing)[0];
    expect(decision.matches.map((match) => match.machineId)).toEqual([1]);
    expect(decision.linksToAdd).toEqual([]);
  });

  test("does not confirm an ambiguous alias without its resolver", () => {
    const videos = [{ videoId: "v3", title: "人気機種を紹介", matchStatus: "unmatched" }];
    const decision = planMachineRematch(videos, machines, [])[0];
    expect(decision.matches).toEqual([]);
    expect(decision.ambiguousMachineIds).toEqual([2]);
  });

  test("reports counts without changing the database", () => {
    const videos = [
      { videoId: "v1", title: "機種A", matchStatus: "matched" },
      { videoId: "v2", title: "人気機種", matchStatus: "unmatched" },
      { videoId: "v3", title: "無関係", matchStatus: "unmatched" },
    ];
    const links = [
      { videoId: "v1", machineId: 1, matchConfidence: 100, matchMethod: "manual" },
      { videoId: "v1", machineId: 2, matchConfidence: 0, matchMethod: "manual_excluded" },
    ];
    const decisions = planMachineRematch(videos, machines, links);
    expect(summarizeMachineRematch(videos, links, decisions)).toMatchObject({
      totalVideos: 3,
      matched: 1,
      ambiguous: 1,
      unmatched: 1,
      manualExcludedPreserved: 1,
    });
  });
});
