import { describe, expect, test } from "bun:test";
import { selectComparisonSnapshots } from "./ranking";

describe("ranking comparison snapshots", () => {
  test("uses oldest and latest available snapshots as provisional data", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-16", subscriberCount: 100 },
      ],
      7,
    );

    expect(result.latest?.subscriberCount).toBe(120);
    expect(result.base?.subscriberCount).toBe(100);
    expect(result.comparisonDays).toBe(2);
    expect(result.isProvisional).toBe(true);
  });

  test("switches to normal comparison when the selected period is complete", () => {
    const result = selectComparisonSnapshots(
      Array.from({ length: 7 }, (_, i) => ({
        date: `2026-07-${String(17 - i).padStart(2, "0")}`,
        subscriberCount: 100 + i,
      })),
      7,
    );

    expect(result.comparisonDays).toBe(7);
    expect(result.isProvisional).toBe(false);
  });

  test("does not inflate comparison days for duplicate dates", () => {
    const result = selectComparisonSnapshots(
      [
        { date: "2026-07-17", subscriberCount: 130 },
        { date: "2026-07-17", subscriberCount: 120 },
        { date: "2026-07-16", subscriberCount: 100 },
      ],
      7,
    );

    expect(result.latest?.subscriberCount).toBe(130);
    expect(result.comparisonDays).toBe(2);
    expect(result.isProvisional).toBe(true);
  });

  test("keeps one snapshot as data accumulation state", () => {
    const result = selectComparisonSnapshots([{ date: "2026-07-17", subscriberCount: 100 }], 30);

    expect(result.comparisonDays).toBe(1);
    expect(result.isProvisional).toBe(false);
  });
});
