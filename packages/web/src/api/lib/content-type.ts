import type { ChannelCategory } from "../data/seed-channels";

export const VIDEO_CONTENT_TYPES = ["standard", "short", "live", "promotion", "unknown"] as const;

export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];

export type VideoContentClassificationInput = {
  title: string;
  durationSeconds?: number | null;
  liveBroadcastContent?: string | null;
  channelCategory?: ChannelCategory | null;
};

export type VideoContentClassification = {
  contentType: VideoContentType;
  reason: string;
  confidence: number;
};

const PROMOTION_TERMS = [
  "cm",
  "pv",
  "プロモーション",
  "ティザー",
  "teaser",
  "プロモ",
  "公式pv",
  "公式映像",
  "試打動画",
];

export function classifyVideoContent(input: VideoContentClassificationInput): VideoContentClassification {
  const title = input.title.trim();
  const normalizedTitle = title.toLowerCase();
  const live = input.liveBroadcastContent?.toLowerCase();

  if (live === "live" || live === "upcoming") {
    return { contentType: "live", reason: `youtube liveBroadcastContent=${live}`, confidence: 100 };
  }
  if (live === "completed" || /生配信|ライブ|live/.test(normalizedTitle)) {
    return { contentType: "live", reason: "live broadcast archive signal", confidence: 90 };
  }

  const manufacturerOrMedia = input.channelCategory === "manufacturer";
  const hasPromotionTerm = PROMOTION_TERMS.some((term) => new RegExp(`(^|[^a-zA-Z0-9])${escapeRegExp(term)}([^a-zA-Z0-9]|$)`, "i").test(title));
  if (manufacturerOrMedia && hasPromotionTerm) {
    return { contentType: "promotion", reason: "manufacturer channel with promotional title signal", confidence: 80 };
  }

  // YouTube Shorts cannot be perfectly identified from duration alone. This treats <=60s as a short candidate.
  if (typeof input.durationSeconds === "number" && input.durationSeconds > 0 && input.durationSeconds <= 60) {
    return { contentType: "short", reason: "duration is 60 seconds or less", confidence: 70 };
  }
  if (/#shorts|#short|shorts/i.test(title)) {
    return { contentType: "short", reason: "shorts title hashtag", confidence: 75 };
  }

  if (!title) return { contentType: "unknown", reason: "missing title", confidence: 0 };
  return { contentType: "standard", reason: "default long-form classification", confidence: 60 };
}

export function isVideoContentType(value: string): value is VideoContentType {
  return (VIDEO_CONTENT_TYPES as readonly string[]).includes(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
