import { describe, expect, test } from "bun:test";
import { selectComparisonSnapshots } from "./ranking";

describe("ranking comparison snapshots", () => {
  test("uses the nearest snapshot on or before the target period start", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-10", subscriberCount: 100 },
      ],
      7,
    );

    expect(result.latest?.subscriberCount).toBe(120);
    expect(result.base?.subscriberCount).toBe(100);
    expect(result.comparisonDays).toBe(7);
    expect(result.status).toBe("ready");
    expect(result.comparisonStartDate).toBe("2026-07-10");
    expect(result.comparisonEndDate).toBe("2026-07-17");
  });

  test("handles missing collection days by using the nearest older baseline", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 150 },
        { date: "2026-07-13", subscriberCount: 130 },
        { date: "2026-07-09", subscriberCount: 100 },
      ],
      7,
    );

    expect(result.base?.date).toBe("2026-07-09");
    expect(result.comparisonDays).toBe(8);
    expect(result.status).toBe("ready");
  });

  test("does not inflate comparison days for duplicate dates", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 130 },
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-10", subscriberCount: 100 },
      ],
      7,
    );

    expect(result.latest?.subscriberCount).toBe(130);
    expect(result.comparisonDays).toBe(7);
    expect(result.status).toBe("ready");
  });

  test("keeps one snapshot as data accumulation state", () => {
    const result = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 100 }], 30);

    expect(result.comparisonDays).toBe(0);
    expect(result.status).toBe("insufficient");
    expect(result.base).toBeNull();
  });
});
