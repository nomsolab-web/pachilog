export function formatJapaneseCount(value: number | null | undefined, unit = "") {
  if (value === null || value === undefined) return "-";

  const abs = Math.abs(value);
  if (abs >= 100_000_000) {
    return `${trimDecimal(value / 100_000_000)}億${unit}`;
  }
  if (abs >= 10_000) {
    return `${trimDecimal(value / 10_000)}万${unit}`;
  }
  return `${value.toLocaleString("ja-JP")}${unit}`;
}

export function formatJapaneseDate(value: string | null | undefined) {
  if (!value) return "データ未取得";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function trimDecimal(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
  }).format(value);
}
