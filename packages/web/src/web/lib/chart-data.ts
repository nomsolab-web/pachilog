export type Snapshot = {
  date: string;
  subscriberCount: number;
  viewCount: number;
};

export type ChartDataPoint = {
  date: string;
  value: number;
  rawVal: number;
  dayDiff: number;
};

export function prepareChartData(
  snapshots: Snapshot[],
  metric: "subscriberCount" | "viewCount"
): {
  data: ChartDataPoint[];
  yDomain: [number, number];
  latestSubscriberCount: number;
  periodStartSubscriberCount: number;
  isPublic: boolean;
  delta: number;
  deltaPct: number;
} {
  // 1. Deduplicate by date (keep latest duplicate) and sort chronologically
  const uniqueSnapshots = Array.from(
    snapshots.reduce((map, s) => {
      if (s.date) {
        map.set(s.date, s);
      }
      return map;
    }, new Map<string, Snapshot>()).values()
  ).sort((a, b) => a.date.localeCompare(b.date));

  // 2. Filter valid data points based on metric
  const isSubscribers = metric === "subscriberCount";
  let filteredSnapshots = uniqueSnapshots.filter((s) => {
    const val = isSubscribers ? s.subscriberCount : s.viewCount;
    return val !== null && val !== undefined && val > 0;
  });

  // Fallback if no public/positive data exists
  if (filteredSnapshots.length === 0) {
    filteredSnapshots = uniqueSnapshots;
  }

  if (filteredSnapshots.length === 0) {
    return {
      data: [],
      yDomain: [0, 100],
      latestSubscriberCount: 0,
      periodStartSubscriberCount: 0,
      isPublic: false,
      delta: 0,
      deltaPct: 0,
    };
  }

  const latestSnapshot = filteredSnapshots[filteredSnapshots.length - 1];
  const firstSnapshot = filteredSnapshots[0];

  const latestSubscriberCount = latestSnapshot.subscriberCount ?? 0;
  const periodStartSubscriberCount = firstSnapshot.subscriberCount ?? 0;

  const isPublic = latestSubscriberCount > 0 && periodStartSubscriberCount > 0;

  const delta = isPublic ? latestSubscriberCount - periodStartSubscriberCount : 0;
  const deltaPct = isPublic && periodStartSubscriberCount > 0
    ? (delta / periodStartSubscriberCount) * 100
    : 0;

  // 4. Map data for chart
  const data = filteredSnapshots.map((s, index, arr) => {
    const rawVal = isSubscribers ? s.subscriberCount : s.viewCount;
    const baseVal = isSubscribers ? periodStartSubscriberCount : 0;
    const plottedValue = rawVal - baseVal;

    let prevRawVal = 0;
    if (index > 0) {
      const prevS = arr[index - 1];
      prevRawVal = isSubscribers ? prevS.subscriberCount : prevS.viewCount;
    } else {
      prevRawVal = rawVal;
    }
    const dayDiff = rawVal - prevRawVal;

    return {
      date: s.date ? s.date.slice(5) : "", // MM-DD
      value: plottedValue,
      rawVal,
      dayDiff,
    };
  });

  // 5. Calculate Y-axis domain with 15% padding
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;

  let yDomain: [number, number];
  if (range === 0) {
    yDomain = [minVal - 100, maxVal + 100];
  } else {
    const padding = range * 0.15;
    yDomain = [Math.floor(minVal - padding), Math.ceil(maxVal + padding)];
  }

  return {
    data,
    yDomain,
    latestSubscriberCount,
    periodStartSubscriberCount,
    isPublic,
    delta,
    deltaPct,
  };
}
