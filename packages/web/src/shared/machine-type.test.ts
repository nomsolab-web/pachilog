import { describe, expect, test } from "bun:test";
import { machineTypeLabel, normalizeMachineType } from "./machine-type";

describe("machine type normalization", () => {
  test("normalizes canonical and legacy pachislot values to slot", () => {
    for (const value of ["slot", "pachislot", "pachislo", "パチスロ", "ぱちすろ", "スロット"]) {
      expect(normalizeMachineType(value)).toBe("slot");
    }
  });

  test("normalizes pachinko spelling variants", () => {
    for (const value of ["pachinko", "パチンコ", "ぱちんこ"]) {
      expect(normalizeMachineType(value)).toBe("pachinko");
    }
  });

  test("does not guess null, empty, or unknown values as slot", () => {
    for (const value of [null, "", "arcade", "pachislot-like"]) {
      expect(normalizeMachineType(value)).toBeNull();
      expect(machineTypeLabel(value)).toBe("種別未設定");
    }
  });
});
