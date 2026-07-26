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

  test("handles empty snapshots list safely", () => {
    const result = selectComparisonSnapshots([], 7);
    expect(result.status).toBe("insufficient");
    expect(result.latest).toBeNull();
    expect(result.base).toBeNull();
  });

  test("handles 2 consecutive snapshots (interval = 1 day)", () => {
    // For period = 7, minPeriodDays is 2, so 1 day difference is insufficient
    const result7 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-16", subscriberCount: 100 },
      ],
      7,
    );
    expect(result7.status).toBe("insufficient");

    // For period = 1, minPeriodDays is 1, so 1 day difference is ready
    const result1 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-16", subscriberCount: 100 },
      ],
      1,
    );
    expect(result1.status).toBe("ready");
    expect(result1.isProvisional).toBe(false); // exact 1-day match for period 1
    expect(result1.comparisonDays).toBe(1);
  });

  test("provisional calculation on gap days", () => {
    // 7 days ago target is 2026-07-10. Closest is 2026-07-11 (diff = 6 days).
    // Minimum threshold for weekly is 2 days. 6 >= 2 is ready and provisional.
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 150 },
        { date: "2026-07-11", subscriberCount: 100 },
      ],
      7,
    );
    expect(result.status).toBe("ready");
    expect(result.isProvisional).toBe(true);
    expect(result.comparisonDays).toBe(6);
    expect(result.base?.date).toBe("2026-07-11");
  });

  test("handles null or hidden subscriber counts safely", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: null },
        { date: "2026-07-10", subscriberCount: undefined },
      ],
      7,
    );
    expect(result.status).toBe("ready");
    expect(result.latest?.subscriberCount).toBeNull();
    expect(result.base?.subscriberCount).toBeUndefined();
  });
});
