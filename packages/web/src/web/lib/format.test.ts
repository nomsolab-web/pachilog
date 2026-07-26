import { describe, expect, test } from "bun:test";
import { formatJapaneseDate } from "./format";

describe("formatJapaneseDate timezone tests", () => {
  test("YYYY-MM-DD does not shift date regardless of local timezone", () => {
    expect(formatJapaneseDate("2026-07-27")).toBe("2026年7月27日");
    expect(formatJapaneseDate("2026-12-31")).toBe("2026年12月31日");
    expect(formatJapaneseDate("2026-01-01")).toBe("2026年1月1日");
  });

  test("ISO strings parse to Asia/Tokyo timezone safely", () => {
    expect(formatJapaneseDate("2026-07-27T00:00:00.000Z")).toBe("2026年7月27日");
    expect(formatJapaneseDate("2026-07-26T23:59:59.000Z")).toBe("2026年7月27日");
    expect(formatJapaneseDate("2026-07-26T14:59:59.000Z")).toBe("2026年7月26日");
    expect(formatJapaneseDate("2026-07-26T15:00:00.000Z")).toBe("2026年7月27日");
  });

  test("returns data not acquired for empty values", () => {
    expect(formatJapaneseDate(null)).toBe("データ未取得");
    expect(formatJapaneseDate(undefined)).toBe("データ未取得");
    expect(formatJapaneseDate("")).toBe("データ未取得");
  });
});
