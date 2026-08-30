import { describe, expect, test } from "bun:test";
import { latestUpdateLabel } from "./index";

describe("homepage update state", () => {
  test("does not show the empty-data label while loading", () => {
    expect(latestUpdateLabel("loading", null)).toBe("読み込み中");
  });

  test("distinguishes successful empty and failed requests", () => {
    expect(latestUpdateLabel("empty", null)).toBe("データなし");
    expect(latestUpdateLabel("error", null)).toBe("取得失敗");
    expect(latestUpdateLabel("ready", "2026-08-30")).toContain("2026");
  });
});
