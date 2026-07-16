import { CHANNEL_CATEGORIES } from "../data/seed-channels";

export function shouldInsertSnapshot(existingDates: readonly string[], date: string) {
  return !existingDates.includes(date);
}

export function isValidChannelCategory(category: string) {
  return (CHANNEL_CATEGORIES as readonly string[]).includes(category);
}

export function findDuplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}
