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

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [_, y, m, d] = match;
    return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function trimDecimal(value: number) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 1,
  }).format(value);
}
