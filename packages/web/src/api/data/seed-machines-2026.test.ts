import { describe, expect, test } from "bun:test";
import { SEED_MACHINES_2026 } from "./seed-machines-2026";

describe("2026 machine seed", () => {
  test("contains at least 50 unique, typed machines", () => {
    const names = SEED_MACHINES_2026.map((machine) => machine.name);
    expect(SEED_MACHINES_2026.length).toBeGreaterThanOrEqual(50);
    expect(new Set(names).size).toBe(names.length);
    expect(SEED_MACHINES_2026.filter((machine) => machine.type === "pachinko").length).toBeGreaterThan(0);
    expect(SEED_MACHINES_2026.filter((machine) => machine.type === "pachislot").length).toBeGreaterThan(0);
  });

  test("does not use guessed aliases", () => {
    expect(SEED_MACHINES_2026.every((machine) => (machine.aliases ?? []).length === 0)).toBe(true);
  });
});
