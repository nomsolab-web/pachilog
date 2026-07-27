import { describe, expect, test } from "bun:test";
import { machineIdentityKey, normalizeMachineMaker, normalizeMachineName } from "./machine-identity";

describe("machine identity normalization", () => {
  test("normalizes spacing, punctuation and Roman numerals", () => {
    expect(normalizeMachineName("ぱちんこ 必殺仕事人Ⅵ")).toBe(normalizeMachineName("ぱちんこ必殺仕事人6"));
  });

  test("normalizes known maker spelling variants", () => {
    expect(normalizeMachineMaker("オッケー.")).toBe(normalizeMachineMaker("オッケー"));
  });

  test("keeps different release dates or types separate", () => {
    const base = { name: "Machine A", maker: "Maker", type: "slot", releaseDate: "2026-01-01" };
    expect(machineIdentityKey(base)).toBe(machineIdentityKey(base));
    expect(machineIdentityKey({ ...base, type: "pachinko" })).not.toBe(machineIdentityKey(base));
    expect(machineIdentityKey({ ...base, releaseDate: "2026-02-01" })).not.toBe(machineIdentityKey(base));
  });
});
