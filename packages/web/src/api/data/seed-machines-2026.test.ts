import { describe, expect, test } from "bun:test";
import { LEGACY_SEED_MACHINES, SEED_MACHINES } from "./seed-machines";
import { SEED_MACHINES_2026 } from "./seed-machines-2026";
import { normalizeMachineType } from "../../shared/machine-type";

describe("2026 machine seed", () => {
  test("contains at least 50 unique, typed machines", () => {
    const names = SEED_MACHINES_2026.map((machine) => machine.name);
    expect(SEED_MACHINES_2026.length).toBeGreaterThanOrEqual(50);
    expect(new Set(names).size).toBe(names.length);
    expect(SEED_MACHINES_2026.filter((machine) => machine.type === "pachinko").length).toBeGreaterThan(0);
    expect(SEED_MACHINES_2026.filter((machine) => machine.type === "slot").length).toBeGreaterThan(0);
  });

  test("does not use guessed aliases", () => {
    expect(SEED_MACHINES_2026.every((machine) => (machine.aliases ?? []).length === 0)).toBe(true);
  });

  test("uses only canonical machine type values", () => {
    expect(SEED_MACHINES_2026.every((machine) => normalizeMachineType(machine.type) === machine.type)).toBe(true);
  });

  test("keeps the five legacy machines and merges duplicate names", () => {
    expect(LEGACY_SEED_MACHINES.map((machine) => machine.name)).toEqual([
      "Lパチスロ からくりサーカス2",
      "P/eフィーバーブルーロック Light ver.",
      "eフィーバー デッドマウント・デスプレイ 魂神9000",
      "ぱちんこ 必殺仕事人VI",
      "デカスタeベルセルク無双 第2章 10連撃Ver.",
    ]);
    expect(new Set(SEED_MACHINES.map((machine) => machine.name)).size).toBe(SEED_MACHINES.length);
  });

  test("has pachinko entries in every month from March through July", () => {
    for (const month of ["03", "04", "05", "06", "07"]) {
      expect(SEED_MACHINES_2026.some((machine) => machine.type === "pachinko" && machine.releaseDate?.startsWith(`2026-${month}-`))).toBe(true);
    }
  });

  test("uses a non-Pioneer source for the YAMASA Tekken machine", () => {
    const machine = SEED_MACHINES_2026.find((item) => item.name.includes("鉄拳"));
    expect(machine?.maker).toBe("山佐ネクスト");
    expect(machine?.sourceUrl).toContain("shinnosuke-ch.com");
  });
});
