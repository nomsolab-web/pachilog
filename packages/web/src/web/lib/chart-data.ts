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

export function calculateYAxisTicks(
  minVal: number,
  maxVal: number
): { ticks: number[]; domain: [number, number] } {
  // If no change, return a simple set of ticks around the value
  if (minVal === maxVal) {
    const val = minVal;
    if (val >= 0) {
      return {
        ticks: [0, 50, 100, 150, 200],
        domain: [-30, 230],
      };
    } else {
      return {
        ticks: [val - 100, val - 50, val, val + 50, val + 100],
        domain: [val - 130, val + 130],
      };
    }
  }

  // Calculate raw range
  const range = maxVal - minVal;

  // Choose target number of tick marks (e.g., 4 to 6)
  const targetTicks = 5;
  const rawStep = range / (targetTicks - 1);

  // Get magnitude (power of 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / magnitude;

  // Round normalizedStep to 1, 2, 5, or 10
  let step: number;
  if (normalizedStep < 1.5) {
    step = 1 * magnitude;
  } else if (normalizedStep < 3) {
    step = 2 * magnitude;
  } else if (normalizedStep < 7) {
    step = 5 * magnitude;
  } else {
    step = 10 * magnitude;
  }

  // Ensure step is at least 1 for small integers
  step = Math.max(1, step);

  // Generate ticks that span the data range
  // Round start tick down to a multiple of step
  let startTick = Math.floor(minVal / step) * step;
  const endTick = Math.ceil(maxVal / step) * step;

  // Clamp startTick to 0 if all values are >= 0
  if (minVal >= 0 && startTick < 0) {
    startTick = 0;
  }

  const ticks: number[] = [];
  for (let t = startTick; t <= endTick; t += step) {
    ticks.push(t);
  }

  // Add 15% padding to domain beyond the extreme ticks
  const domainMin = startTick - step * 0.15;
  const domainMax = endTick + step * 0.15;

  return {
    ticks,
    domain: [domainMin, domainMax],
  };
}

export function prepareChartData(
  snapshots: Snapshot[],
  metric: "subscriberCount" | "viewCount"
): {
  data: ChartDataPoint[];
  yDomain: [number, number];
  ticks: number[];
  latestSubscriberCount: number;
  periodStartSubscriberCount: number;
  isPublic: boolean;
  delta: number;
  deltaPct: number;
  periodDays: number;
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
      ticks: [0, 25, 50, 75, 100],
      latestSubscriberCount: 0,
      periodStartSubscriberCount: 0,
      isPublic: false,
      delta: 0,
      deltaPct: 0,
      periodDays: 0,
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

  // 5. Calculate Y-axis ticks and domain
  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const { ticks, domain: yDomain } = calculateYAxisTicks(minVal, maxVal);

  // 6. Calculate periodDays
  let periodDays = 0;
  if (firstSnapshot && latestSnapshot && firstSnapshot.date && latestSnapshot.date) {
    const firstDate = new Date(firstSnapshot.date);
    const lastDate = new Date(latestSnapshot.date);
    if (!isNaN(firstDate.getTime()) && !isNaN(lastDate.getTime())) {
      const diffTime = Math.abs(lastDate.getTime() - firstDate.getTime());
      periodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  return {
    data,
    yDomain,
    ticks,
    latestSubscriberCount,
    periodStartSubscriberCount,
    isPublic,
    delta,
    deltaPct,
    periodDays,
  };
}
