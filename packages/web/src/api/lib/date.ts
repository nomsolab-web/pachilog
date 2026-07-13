export const DATA_TIME_ZONE = "Asia/Tokyo";

/** Return YYYY-MM-DD in the timezone used for daily PachiLog snapshots. */
export function dateStringInTimeZone(date = new Date(), timeZone = DATA_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
