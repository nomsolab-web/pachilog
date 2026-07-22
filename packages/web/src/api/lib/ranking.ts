type SnapshotLike = {
  date: string;
  subscriberCount: number;
};

export type ComparisonStatus = "ready" | "insufficient";

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
  const base = targetDate
    ? ordered
        .filter((snapshot) => snapshot.date <= targetDate)
        .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    : null;
  const comparisonDays = latest && base ? daysBetween(base.date, latest.date) : 0;

  return {
    latest,
    base,
    comparisonDays,
    comparisonStartDate: base?.date ?? null,
    comparisonEndDate: latest?.date ?? null,
    status: latest && base ? ("ready" as ComparisonStatus) : ("insufficient" as ComparisonStatus),
    isProvisional: false,
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
