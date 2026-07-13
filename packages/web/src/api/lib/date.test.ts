import { describe, expect, test } from "bun:test";
import { dateStringInTimeZone } from "./date";

describe("dateStringInTimeZone", () => {
  test("uses the new day after midnight in Japan", () => {
    const instant = new Date("2026-07-13T15:30:00.000Z");
    expect(dateStringInTimeZone(instant)).toBe("2026-07-14");
  });

  test("does not advance the date before midnight in Japan", () => {
    const instant = new Date("2026-07-13T14:59:59.000Z");
    expect(dateStringInTimeZone(instant)).toBe("2026-07-13");
  });
});
