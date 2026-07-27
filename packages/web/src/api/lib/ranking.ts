type SnapshotLike = {
  date: string;
  subscriberCount: number | null | undefined;
};

export type ComparisonStatus = "ready" | "insufficient";

function isComparisonDaysAllowed(period: number, comparisonDays: number): boolean {
  if (period === 1) {
    return comparisonDays >= 1 && comparisonDays <= 3;
  }
  if (period === 7) {
    return comparisonDays >= 5 && comparisonDays <= 9;
  }
  if (period === 30) {
    return comparisonDays >= 21 && comparisonDays <= 39;
  }
  if (period === 90) {
    return comparisonDays >= 60 && comparisonDays <= 120;
  }
  return false;
}

function dateDiffAbs(d1: string, d2: string): number {
  const t1 = new Date(`${d1}T00:00:00.000Z`).getTime();
  const t2 = new Date(`${d2}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return Infinity;
  return Math.round(Math.abs(t2 - t1) / 86_400_000);
}

export function selectComparisonSnapshots<T extends SnapshotLike>(
  snapshots: readonly T[],
  period: number,
  referenceDate?: string,
) {
  const uniqueByDate = new Map<string, T>();
  for (const snapshot of snapshots) {
    if (!uniqueByDate.has(snapshot.date)) uniqueByDate.set(snapshot.date, snapshot);
  }

  const ordered = [...uniqueByDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  const latest = referenceDate ? ordered.find((snapshot) => snapshot.date <= referenceDate) ?? null : ordered[0] ?? null;
  const targetDate = latest ? shiftDate(latest.date, -period) : null;

  let base: T | null = null;
  if (latest && targetDate) {
    let minDiff = Infinity;
    for (const snapshot of ordered) {
      if (snapshot.date === latest.date) continue;
      // Requirement 4: exclude future baselines relative to latest date
      if (snapshot.date >= latest.date) continue;
      // Requirement 3: Skip snapshots with null/undefined subscriber counts
      if (snapshot.subscriberCount === null || snapshot.subscriberCount === undefined) continue;

      const diff = dateDiffAbs(snapshot.date, targetDate);
      if (diff < minDiff) {
        minDiff = diff;
        base = snapshot;
      } else if (diff === minDiff && base) {
        if (snapshot.date < base.date) {
          base = snapshot;
        }
      }
    }
  }

  // Requirement 6: subscriberCount must not be null/undefined
  const isSubscriberCountValid = (snapshot: T | null): boolean => {
    if (!snapshot) return false;
    return snapshot.subscriberCount !== null && snapshot.subscriberCount !== undefined;
  };

  const hasValidSubscribers = isSubscriberCountValid(latest) && isSubscriberCountValid(base);

  const rawComparisonDays = latest && base ? daysBetween(base.date, latest.date) : 0;
  const hasEnoughData = latest && base && hasValidSubscribers && isComparisonDaysAllowed(period, rawComparisonDays);

  const comparisonDays = hasEnoughData ? rawComparisonDays : 0;

  return {
    latest: hasEnoughData ? latest : null,
    base: hasEnoughData ? base : null,
    comparisonDays,
    comparisonStartDate: hasEnoughData ? base.date : null,
    comparisonEndDate: hasEnoughData ? latest.date : null,
    status: hasEnoughData ? ("ready" as ComparisonStatus) : ("insufficient" as ComparisonStatus),
    isProvisional: hasEnoughData && comparisonDays !== period,
  };
}

export function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
