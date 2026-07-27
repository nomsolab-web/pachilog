import { describe, expect, test } from "bun:test";
import { buildMachineSeedValues } from "./machine-seed-values";

describe("machine seed persistence values", () => {
  test("includes all alias fields for new inserts and specified updates", () => {
    const values = buildMachineSeedValues({
      name: "Pテスト機種",
      maker: "テストメーカー",
      releaseDate: "2026-07-01",
      uniqueAliases: ["テスト機種A"],
      ambiguousAliases: ["テスト"],
      resolvingKeywords: ["公式"],
    });
    expect(values).toMatchObject({
      uniqueAliases: ["テスト機種A"],
      ambiguousAliases: ["テスト"],
      resolvingKeywords: ["公式"],
    });
  });

  test("omits unspecified alias fields so existing DB values are preserved", () => {
    const values = buildMachineSeedValues({ name: "P既存機種", maker: "既存メーカー", releaseDate: null });
    expect(values).not.toHaveProperty("uniqueAliases");
    expect(values).not.toHaveProperty("ambiguousAliases");
    expect(values).not.toHaveProperty("resolvingKeywords");
  });

  test("persists only canonical machine type values", () => {
    expect(buildMachineSeedValues({ name: "slot", maker: "maker", releaseDate: null, type: "pachislot" }).type).toBe("slot");
    expect(buildMachineSeedValues({ name: "pachinko", maker: "maker", releaseDate: null, type: "パチンコ" }).type).toBe("pachinko");
    expect(buildMachineSeedValues({ name: "unknown", maker: "maker", releaseDate: null, type: "unverified" }).type).toBeNull();
  });
});
