import { describe, expect, test } from "bun:test";
import { prepareChartData, calculateYAxisTicks, type Snapshot } from "./chart-data";

describe("calculateYAxisTicks helper", () => {
  test("0人から+10,000人の増加", () => {
    // Expect step size = 2000, ticks = [0, 2000, 4000, 6000, 8000, 10000]
    const { ticks, domain } = calculateYAxisTicks(0, 10000);
    expect(ticks).toEqual([0, 2000, 4000, 6000, 8000, 10000]);
    expect(domain[0]).toBeCloseTo(-300); // 0 - 300
    expect(domain[1]).toBeCloseTo(10300); // 10000 + 300
  });

  test("-1,000人から+1,000人の増減", () => {
    // Expect step size = 500, ticks = [-1000, -500, 0, 500, 1000]
    const { ticks, domain } = calculateYAxisTicks(-1000, 1000);
    expect(ticks).toEqual([-1000, -500, 0, 500, 1000]);
    expect(domain[0]).toBeCloseTo(-1075);
    expect(domain[1]).toBeCloseTo(1075);
  });

  test("変化なし (0人)", () => {
    const { ticks, domain } = calculateYAxisTicks(0, 0);
    expect(ticks).toEqual([0, 50, 100, 150, 200]);
    expect(domain).toEqual([-30, 230]);
  });

  test("数十人程度の増加 (30人)", () => {
    // Expect step size = 10, ticks = [0, 10, 20, 30]
    const { ticks, domain } = calculateYAxisTicks(0, 30);
    expect(ticks).toEqual([0, 10, 20, 30]);
    expect(domain[0]).toBeCloseTo(-1.5);
    expect(domain[1]).toBeCloseTo(31.5);
  });

  test("数万人規模の増加 (50,000人)", () => {
    // Expect step size = 10000, ticks = [0, 10000, 20000, 30000, 40000, 50000]
    const { ticks, domain } = calculateYAxisTicks(0, 50000);
    expect(ticks).toEqual([0, 10000, 20000, 30000, 40000, 50000]);
    expect(domain[0]).toBeCloseTo(-1500);
    expect(domain[1]).toBeCloseTo(51500);
  });
});

describe("prepareChartData helper", () => {
  test("増加: calculates positive growth from period start", () => {
    const snapshots: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 100000, viewCount: 500 },
      { date: "2026-07-02", subscriberCount: 100100, viewCount: 600 },
      { date: "2026-07-03", subscriberCount: 100300, viewCount: 700 },
    ];

    const result = prepareChartData(snapshots, "subscriberCount");

    expect(result.data).toHaveLength(3);
    expect(result.data[0]).toEqual({ date: "07-01", value: 0, rawVal: 100000, dayDiff: 0 });
    expect(result.data[1]).toEqual({ date: "07-02", value: 100, rawVal: 100100, dayDiff: 100 });
    expect(result.data[2]).toEqual({ date: "07-03", value: 300, rawVal: 100300, dayDiff: 200 });

    expect(result.latestSubscriberCount).toBe(100300);
    expect(result.periodStartSubscriberCount).toBe(100000);
    expect(result.isPublic).toBe(true);
    expect(result.delta).toBe(300);
    expect(result.deltaPct).toBeCloseTo(0.3);

    // min 0, max 300 -> step size = 100. ticks = [0, 100, 200, 300]
    expect(result.ticks).toEqual([0, 100, 200, 300]);
    expect(result.yDomain[0]).toBeCloseTo(-15);
    expect(result.yDomain[1]).toBeCloseTo(315);
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
    expect(result.deltaPct).toBeCloseTo(-0.4);

    // min -200, max 0 -> range 200, step 50. ticks = [-200, -150, -100, -50, 0]
    expect(result.ticks).toEqual([-200, -150, -100, -50, 0]);
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
    expect(result.ticks).toEqual([0, 50, 100, 150, 200]);
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
    expect(result.ticks).toEqual([0, 50, 100, 150, 200]);
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

    expect(result.data).toHaveLength(2);
    expect(result.data[0].date).toBe("07-01");
    expect(result.data[0].rawVal).toBe(10050);
    expect(result.data[1].date).toBe("07-02");
    expect(result.data[1].rawVal).toBe(10100);

    expect(result.periodStartSubscriberCount).toBe(10050);
    expect(result.latestSubscriberCount).toBe(10100);
  });

  test("期間表示日数: calculates periodDays based on calendar days", () => {
    const snapshots1: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-07", subscriberCount: 10050, viewCount: 120 },
    ];
    const result1 = prepareChartData(snapshots1, "subscriberCount");
    expect(result1.periodDays).toBe(7);

    const snapshots2: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-01", subscriberCount: 10010, viewCount: 105 },
      { date: "2026-07-07", subscriberCount: 10050, viewCount: 120 },
    ];
    const result2 = prepareChartData(snapshots2, "subscriberCount");
    expect(result2.periodDays).toBe(7);

    const snapshots3: Snapshot[] = [
      { date: "2026-07-01", subscriberCount: 10000, viewCount: 100 },
      { date: "2026-07-05", subscriberCount: 10050, viewCount: 120 },
    ];
    const result3 = prepareChartData(snapshots3, "subscriberCount");
    expect(result3.periodDays).toBe(5);
  });
});
