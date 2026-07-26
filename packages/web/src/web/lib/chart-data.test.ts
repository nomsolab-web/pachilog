import { describe, expect, test } from "bun:test";
import { prepareChartData, type Snapshot } from "./chart-data";

describe("prepareChartData helper", () => {
  test("増加: calculates positive growth from period start", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 100000, viewCount: 500 },
      { date: "2026-07-02", subscriberCount: 100100, viewCount: 600 },
      { date: "2026-07-03", subscriberCount: 100300, viewCount: 700 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(3);
    // Values mapped: s.subscriberCount - periodStartSubscriberCount (100000)
    expect(result.data[0]).toEqual({ date: "07-01", value: 0, rawVal: 100000, dayDiff: 0 });
    expect(result.data[1]).toEqual({ date: "07-02", value: 100, rawVal: 100100, dayDiff: 100 });
    expect(result.data[2]).toEqual({ date: "07-03", value: 300, rawVal: 100300, dayDiff: 200 });

    expect(result.latestSubscriberCount).toBe(100300);
    expect(result.periodStartSubscriberCount).toBe(100000);
    expect(result.isPublic).toBe(true);
    expect(result.delta).toBe(300);
    expect(result.deltaPct).toBeCloseTo(0.3); // 300 / 100000 * 100 = 0.3%

    // Domain range: min 0, max 300, range 300. Padding: 300 * 0.15 = 45. [0-45, 300+45] = [-45, 345]
    expect(result.yDomain).toEqual([-45, 345]);
  });

  test("減少: calculates negative growth from period start", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 50000, viewCount: 1000 },
      { date: "2026-07-02", subscriberCount: 49950, viewCount: 1100 },
      { date: "2026-07-03", subscriberCount: 49800, viewCount: 1200 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(3);
    expect(result.data[0].value).toBe(0);
    expect(result.data[1].value).toBe(-50);
    expect(result.data[2].value).toBe(-200);

    expect(result.latestSubscriberCount).toBe(49800);
    expect(result.periodStartSubscriberCount).toBe(50000);
    expect(result.isPublic).toBe(true);
    expect(result.delta).toBe(-200);
    expect(result.deltaPct).toBeCloseTo(-0.4); // -200 / 50000 * 100 = -0.4%

    // Domain range: min -200, max 0, range 200. Padding: 200 * 0.15 = 30. [-200-30, 0+30] = [-230, 30]
    expect(result.yDomain).toEqual([-230, 30]);
  });

  test("変化なし: handles zero change during the period smoothly", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 1000 },
      { date: "2026-07-02", subscriberCount: 10000, viewCount: 1100 },
      { date: "2026-07-03", subscriberCount: 10000, viewCount: 1200 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(3);
    expect(result.data[0].value).toBe(0);
    expect(result.data[1].value).toBe(0);
    expect(result.data[2].value).toBe(0);

    expect(result.delta).toBe(0);
    expect(result.deltaPct).toBe(0);

    // Range is 0, so domain should fallback to [value - 100, value + 100] = [-100, 100]
    expect(result.yDomain).toEqual([-100, 100]);
  });

  test("1日分のみ: handles single data point safely", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 1000, viewCount: 100 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(1);
    expect(result.data[0].value).toBe(0);
    expect(result.delta).toBe(0);
    expect(result.deltaPct).toBe(0);
    expect(result.yDomain).toEqual([-100, 100]);
  });

  test("欠損日あり: sorts snapshots chronologically and maps correctly", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-05", subscriberCount: 10050, viewCount: 500 },
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 400 },
      { date: "2026-07-03", subscriberCount: 10020, viewCount: 450 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(3);
    expect(result.data[0].date).toBe("07-01");
    expect(result.data[1].date).toBe("07-03");
    expect(result.data[2].date).toBe("07-05");

    expect(result.data[0].value).toBe(0);
    expect(result.data[1].value).toBe(20);
    expect(result.data[2].value).toBe(50);
  });

  test("登録者数非公開: handles non-public or zero subscriber count safely", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 0, viewCount: 100 },
      { date: "2026-07-02", subscriberCount: 0, viewCount: 200 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.isPublic).toBe(false);
    expect(result.delta).toBe(0);
    expect(result.deltaPct).toBe(0);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].value).toBe(0);
    expect(result.data[1].value).toBe(0);
  });

  test("重複日付: deduplicates and picks latest data point", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-01", subscriberCount: 10050, viewCount: 110 },
      { date: "2026-07-02", subscriberCount: 10100, viewCount: 120 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    // The duplicate 2026-07-01 should be deduplicated, keeping the latest one (10050)
    expect(result.data).toHaveLength(2);
    expect(result.data[0].date).toBe("07-01");
    expect(result.data[0].rawVal).toBe(10050);
    expect(result.data[1].date).toBe("07-02");
    expect(result.data[1].rawVal).toBe(10100);

    expect(result.periodStartSubscriberCount).toBe(10050);
    expect(result.latestSubscriberCount).toBe(10100);
  });

  test("期間表示日数: calculates periodDays based on calendar days", () => {
    // 2026-07-01 to 2026-07-07 represents 7 days
    const snapshots1: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-07", subscriberCount: 10050, viewCount: 120 },
    ];
    const result1 = prepareChartData(snapshots1, "subscriberCount");
    expect(result1.periodDays).toBe(7);

    // With duplicate dates, it should still be 7 days
    const snapshots2: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-01", subscriberCount: 10010, viewCount: 105 },
      { date: "2026-07-07", subscriberCount: 10050, viewCount: 120 },
    ];
    const result2 = prepareChartData(snapshots2, "subscriberCount");
    expect(result2.periodDays).toBe(7);

    // With missing days, it calculates calendar-based difference (e.g. 01 to 05 is 5 days)
    const snapshots3: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-05", subscriberCount: 10050, viewCount: 120 },
    ];
    const result3 = prepareChartData(snapshots3, "subscriberCount");
    expect(result3.periodDays).toBe(5);
  });
});
