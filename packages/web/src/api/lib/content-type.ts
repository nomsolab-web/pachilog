import type { ChannelCategory } from "../data/seed-channels";

export const VIDEO_CONTENT_TYPES = ["standard", "short", "live", "promotion", "unknown"] as const;
export type VideoContentType = (typeof VIDEO_CONTENT_TYPES)[number];
export const RANKABLE_VIDEO_CONTENT_TYPES = ["standard", "short", "live"] as const;

export function isRankableVideoContentType(value: VideoContentType) {
  return (RANKABLE_VIDEO_CONTENT_TYPES as readonly string[]).includes(value);
}

export type YoutubeLiveStreamingDetails = {
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
};

export type VideoContentClassificationInput = {
  title: string;
  durationSeconds?: number | null;
  liveBroadcastContent?: string | null;
  liveStreamingDetails?: YoutubeLiveStreamingDetails | null;
  channelCategory?: ChannelCategory | null;
  existingContentType?: VideoContentType | null;
};

export type VideoContentClassification = {
  contentType: VideoContentType;
  reason: string;
  confidence: number;
};

const OFFICIAL_PROMOTION_CHANNEL_CATEGORIES = new Set<ChannelCategory>(["manufacturer", "hall", "media"]);
const STRONG_PROMOTION_PATTERNS = [
  /web\s*cm/i,
  /\u3010\s*web\s*cm\s*\u3011/i,
  /\u516c\u5f0f\s*pv/i,
  /\u30d7\u30ed\u30e2\u30fc\u30b7\u30e7\u30f3(?:\s*\u30e0\u30fc\u30d3\u30fc|\s*\u52d5\u753b)?/i,
  /\u30c6\u30a3\u30b6\u30fc/i,
  /\u6a5f\u7a2e\u516c\u5f0f\u6620\u50cf/i,
  /\u516c\u5f0f\u6620\u50cf/i,
];
const BOUNDED_PROMOTION_PATTERNS = [
  /(^|[^a-z0-9])cm([^a-z0-9]|$)/i,
  /(^|[^a-z0-9])pv([^a-z0-9]|$)/i,
];
const LIVE_CLIP_OR_NON_LIVE_PATTERNS = [
  /\u751f\u914d\u4fe1.*(?:\u898b\u3069\u3053\u308d|\u307f\u3069\u3053\u308d|\u307e\u3068\u3081|\u5207\u308a\u629c\u304d|\u5207\u629c|\u30c0\u30a4\u30b8\u30a7\u30b9\u30c8)/i,
  /(?:\u898b\u3069\u3053\u308d|\u307f\u3069\u3053\u308d|\u307e\u3068\u3081|\u5207\u308a\u629c\u304d|\u5207\u629c|\u30c0\u30a4\u30b8\u30a7\u30b9\u30c8).*\u751f\u914d\u4fe1/i,
  /\u6b4c\u3063\u3066\u307f\u305f/i,
  /\u30e9\u30a4\u30d6\u5b9f\u6226/i,
  /\u30cf\u30e9\u30ad\u30ea\s*drive/i,
  /\u30cf\u30e9\u30ad\u30ea\u30c9\u30e9\u30a4\u30d6/i,
];
const SHORTS_HASHTAG_PATTERN = /(^|[\s#])#?shorts?(\s|$)/i;
const PACHINKO_SHORT_FALSE_POSITIVE_PATTERN = /\u30b7\u30e7\u30fc\u30c8\s*st/i;

export function classifyVideoContent(input: VideoContentClassificationInput): VideoContentClassification {
  const title = input.title.trim();
  const normalizedTitle = title.toLowerCase();
  const officialChannel = input.channelCategory ? OFFICIAL_PROMOTION_CHANNEL_CATEGORIES.has(input.channelCategory) : false;

  if (!title) return { contentType: "unknown", reason: "missing title", confidence: 0 };
  const promotion = promotionReason(title, officialChannel);
  if (promotion) return { contentType: "promotion", reason: promotion, confidence: 90 };
  const live = liveReason(input);
  if (live) return { contentType: "live", reason: live, confidence: 95 };
  const short = shortReason(normalizedTitle, input.durationSeconds);
  if (short) return { contentType: "short", reason: short, confidence: 75 };
  return { contentType: "standard", reason: "default long-form classification", confidence: 60 };
}

export function isVideoContentType(value: string): value is VideoContentType {
  return (VIDEO_CONTENT_TYPES as readonly string[]).includes(value);
}

function promotionReason(title: string, officialChannel: boolean) {
  if (!officialChannel) return null;
  if (STRONG_PROMOTION_PATTERNS.some((pattern) => pattern.test(title))) return "official channel with strong promotional title signal";
  if (BOUNDED_PROMOTION_PATTERNS.some((pattern) => pattern.test(title))) return "official channel with bounded CM/PV title signal";
  return null;
}

function liveReason(input: VideoContentClassificationInput) {
  const liveBroadcastContent = input.liveBroadcastContent?.toLowerCase();
  const details = input.liveStreamingDetails;
  if (liveBroadcastContent === "live" || liveBroadcastContent === "upcoming") return `youtube liveBroadcastContent=${liveBroadcastContent}`;
  if (details?.actualStartTime || details?.actualEndTime || details?.scheduledStartTime) {
    return "youtube liveStreamingDetails contains a broadcast timestamp";
  }
  if (input.existingContentType === "live") return "existing live classification retained because live metadata is inconclusive";
  if (LIVE_CLIP_OR_NON_LIVE_PATTERNS.some((pattern) => pattern.test(input.title))) return null;
  return null;
}

function shortReason(normalizedTitle: string, durationSeconds: number | null | undefined) {
  if (PACHINKO_SHORT_FALSE_POSITIVE_PATTERN.test(normalizedTitle)) return null;
  if (SHORTS_HASHTAG_PATTERN.test(normalizedTitle)) return "shorts title hashtag";
  if (typeof durationSeconds === "number" && durationSeconds > 0 && durationSeconds <= 60) {
    // The current YouTube API response has no direct Shorts flag, so duration is only a fallback signal.
    return "duration is 60 seconds or less";
  }
  return null;
}
