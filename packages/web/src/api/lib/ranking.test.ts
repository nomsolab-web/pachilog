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
    // For period = 7, 1 day difference is outside allowed range (5..9), so insufficient
    const result7 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-16", subscriberCount: 100 },
      ],
      7,
    );
    expect(result7.status).toBe("insufficient");

    // For period = 1, 1 day difference is allowed (1..3), so ready
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

  test("provisional calculation on gap days within range", () => {
    // 7 days ago target is 2026-07-10. Closest is 2026-07-11 (diff = 6 days).
    // Weekly range is 5..9. 6 is inside the range, so ready and provisional.
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

  test("excludes snapshots outside the allowed comparison ranges", () => {
    // For period = 1, max is 3 days. 4 days must be insufficient.
    const resultDaily4 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 150 },
        { date: "2026-07-13", subscriberCount: 100 },
      ],
      1,
    );
    expect(resultDaily4.status).toBe("insufficient");

    // For period = 7, min is 5 days. 4 days must be insufficient.
    const resultWeekly4 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 150 },
        { date: "2026-07-13", subscriberCount: 100 },
      ],
      7,
    );
    expect(resultWeekly4.status).toBe("insufficient");
  });

  test("isProvisional checks for exact vs non-exact matches", () => {
    // period=1, 1 day: isProvisional = false
    const p1_1 = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 120 }, { date: "2026-07-16", subscriberCount: 100 }], 1);
    expect(p1_1.isProvisional).toBe(false);

    // period=1, 2 days: isProvisional = true
    const p1_2 = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 120 }, { date: "2026-07-15", subscriberCount: 100 }], 1);
    expect(p1_2.isProvisional).toBe(true);

    // period=7, 6 days: isProvisional = true
    const p7_6 = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 120 }, { date: "2026-07-11", subscriberCount: 100 }], 7);
    expect(p7_6.isProvisional).toBe(true);

    // period=7, 7 days: isProvisional = false
    const p7_7 = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 120 }, { date: "2026-07-10", subscriberCount: 100 }], 7);
    expect(p7_7.isProvisional).toBe(false);

    // period=7, 8 days: isProvisional = true
    const p7_8 = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 120 }, { date: "2026-07-09", subscriberCount: 100 }], 7);
    expect(p7_8.isProvisional).toBe(true);

    // period=30, 30 days: isProvisional = false
    const p30_30 = selectComparisonSnapshots([{ date: "2026-07-31", subscriberCount: 120 }, { date: "2026-07-01", subscriberCount: 100 }], 30);
    expect(p30_30.isProvisional).toBe(false);

    // period=30, 31 days: isProvisional = true
    const p30_31 = selectComparisonSnapshots([{ date: "2026-08-01", subscriberCount: 120 }, { date: "2026-07-01", subscriberCount: 100 }], 30);
    expect(p30_31.isProvisional).toBe(true);
  });

  test("excludes future snapshots relative to latest date", () => {
    // latest is chosen as 2026-07-17 (via referenceDate).
    // Future baseline (2026-07-20) must be skipped.
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-20", subscriberCount: 200 },
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-10", subscriberCount: 100 },
      ],
      7,
      "2026-07-17",
    );
    expect(result.latest?.date).toBe("2026-07-17");
    expect(result.base?.date).toBe("2026-07-10");
    expect(result.status).toBe("ready");
  });

  test("null or hidden subscriber counts cause insufficient status", () => {
    const result1 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: null },
        { date: "2026-07-10", subscriberCount: 100 },
      ],
      7,
    );
    expect(result1.status).toBe("insufficient");

    const result2 = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-10", subscriberCount: undefined },
      ],
      7,
    );
    expect(result2.status).toBe("insufficient");
  });
});
