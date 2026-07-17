type SnapshotLike = {
  date: string;
  subscriberCount: number;
};

export function selectComparisonSnapshots<T extends SnapshotLike>(snapshots: readonly T[], period: number) {
  const uniqueByDate = new Map<string, T>();
  for (const snapshot of snapshots) {
    if (!uniqueByDate.has(snapshot.date)) uniqueByDate.set(snapshot.date, snapshot);
  }

  const periodSnapshots = [...uniqueByDate.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, period);
  const latest = periodSnapshots[0] ?? null;
  const base = periodSnapshots.at(-1) ?? null;
  const comparisonDays = periodSnapshots.length;

  return {
    latest,
    base,
    comparisonDays,
    isProvisional: comparisonDays > 1 && comparisonDays < period,
  };
}
