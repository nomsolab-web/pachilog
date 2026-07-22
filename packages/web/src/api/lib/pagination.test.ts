import { describe, expect, test } from "bun:test";
import { clampLimit, parseOffsetCursor } from "./pagination";

describe("pagination helpers", () => {
  test("clamps invalid and oversized limits", () => {
    expect(clampLimit(undefined, 50, 100)).toBe(50);
    expect(clampLimit("0", 50, 100)).toBe(50);
    expect(clampLimit("250", 50, 100)).toBe(100);
    expect(clampLimit("20", 50, 100)).toBe(20);
  });

  test("parses offset cursors safely", () => {
    expect(parseOffsetCursor(undefined)).toBe(0);
    expect(parseOffsetCursor("-1")).toBe(0);
    expect(parseOffsetCursor("abc")).toBe(0);
    expect(parseOffsetCursor("20")).toBe(20);
  });
});
