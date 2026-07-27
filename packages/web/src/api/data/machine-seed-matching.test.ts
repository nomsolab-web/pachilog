import { describe, expect, test } from "bun:test";
import { DUPLICATE_MACHINE_GROUPS } from "./merge-duplicate-machines";
import { SEED_MACHINES } from "./seed-machines";
import { findExistingMachineForSeed, planSeedMachineUpserts } from "../lib/machine-seed-matching";
import { machineIdentityKey } from "../lib/machine-identity";

describe("duplicate-safe machine seed matching", () => {
  test("matches all three canonical groups without inserting after merge", () => {
    const seeds = DUPLICATE_MACHINE_GROUPS.map((group) => {
      const seed = SEED_MACHINES.find((candidate) => candidate.name === group.canonical.name);
      expect(seed).toBeDefined();
      expect(machineIdentityKey(seed!)).toBe(machineIdentityKey(group.canonical));
      return seed!;
    });
    const existing = DUPLICATE_MACHINE_GROUPS.map((group) => ({ id: group.canonicalId, ...group.canonical }));
    expect(planSeedMachineUpserts(existing, seeds)).toEqual({ inserts: 0, updates: 3 });
    for (const seed of seeds) expect(findExistingMachineForSeed(existing, seed)?.id).toBeGreaterThan(0);
  });

  test("does not match a different numeric specification", () => {
    const canonical = DUPLICATE_MACHINE_GROUPS[1].canonical;
    expect(findExistingMachineForSeed([{ id: 6, ...canonical }], { ...canonical, name: "eフィーバー デッドマウント・デスプレイ 魂神8000" })).toBeUndefined();
  });
});
