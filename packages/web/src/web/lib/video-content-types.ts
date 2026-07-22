export const VIDEO_CONTENT_TYPE_VALUES = ["standard", "short", "live", "promotion", "unknown"] as const;

export type VideoContentTypeValue = (typeof VIDEO_CONTENT_TYPE_VALUES)[number];

export type VideoContentTypeTab = {
  value: VideoContentTypeValue;
  label: string;
};

export const VIDEO_CONTENT_TYPE_TABS: VideoContentTypeTab[] = [
  { value: "standard", label: "通常動画" },
  { value: "short", label: "ショート" },
  { value: "live", label: "ライブ" },
  { value: "promotion", label: "公式PV・CM" },
  { value: "unknown", label: "その他" },
];

export const DEFAULT_VIDEO_CONTENT_TYPE: VideoContentTypeValue = "standard";

export function isVideoContentTypeValue(value: string | null | undefined): value is VideoContentTypeValue {
  return !!value && (VIDEO_CONTENT_TYPE_VALUES as readonly string[]).includes(value);
}

export function parseVideoContentType(value: string | null | undefined): VideoContentTypeValue {
  return isVideoContentTypeValue(value) ? value : DEFAULT_VIDEO_CONTENT_TYPE;
}

export function videoContentTypeLabel(value: string | null | undefined) {
  return VIDEO_CONTENT_TYPE_TABS.find((tab) => tab.value === value)?.label ?? "その他";
}

export function updateContentTypeSearchParams(
  search: string,
  nextContentType: VideoContentTypeValue,
  options: { resetCursor?: boolean } = {},
) {
  const params = new URLSearchParams(search);
  params.set("contentType", nextContentType);
  if (options.resetCursor) params.delete("cursor");
  return params;
}

export function normalizeContentTypeSearchParams(search: string) {
  const params = new URLSearchParams(search);
  const rawContentType = params.get("contentType");
  const rawLegacyType = params.get("type");
  const normalized = parseVideoContentType(rawContentType ?? rawLegacyType);
  const shouldReplace =
    params.has("type") || params.has("cursor") || (rawContentType !== null && rawContentType !== normalized);

  if (shouldReplace) {
    params.set("contentType", normalized);
    params.delete("type");
    params.delete("cursor");
  }

  return {
    contentType: normalized,
    params,
    shouldReplace,
  };
}

export function videoTrendingQueryParams(
  mode: "previous" | "7d",
  contentType: VideoContentTypeValue,
  cursor?: string,
) {
  return {
    mode,
    contentType,
    limit: "20",
    ...(cursor ? { cursor } : {}),
  };
}

export function machineDetailQueryParams(contentType: VideoContentTypeValue) {
  return { contentType };
}

export function videoTrendMetricLabel(video: {
  hasTrend: boolean;
  viewDelta: number;
  viewDeltaPct: number;
  isProvisional?: boolean;
  snapshotDays?: number;
}) {
  if (!video.hasTrend) return "データ蓄積中";
  return `+${video.viewDelta.toLocaleString("ja-JP")}回 / ${video.viewDeltaPct.toFixed(1)}%${
    video.isProvisional ? ` (${video.snapshotDays ?? 0}日)` : ""
  }`;
}
