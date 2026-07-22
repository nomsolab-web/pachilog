import { isNotNull } from "drizzle-orm";
import { SEED_CHANNELS } from "../data/seed-channels";
import { chunkArray, selectChannelThumbnailUrl, withYoutubeRetry } from "./youtube";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

export const DEFAULT_CHANNEL_DISCOVERY_QUERIES = [
  "パチンコ 実践",
  "パチスロ 実践",
  "スマスロ 実践",
  "新台 パチンコ",
  "新台 スロット",
] as const;

export type ChannelDiscoveryOptions = {
  days: number;
  limit: number;
  minVideos: number;
  queries?: readonly string[];
  now?: Date;
};

export type DiscoverySearchVideo = {
  videoId: string;
  channelId: string;
  channelTitle: string | null;
  title: string;
  publishedAt: string;
  videoUrl: string;
};

export type DiscoveryChannelDetails = {
  channelId: string;
  title: string;
  channelUrl: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  viewCount: number;
  videoCount: number;
  publishedAt: string | null;
  description: string;
};

export type ChannelCandidate = DiscoveryChannelDetails & {
  matchedQueries: string[];
  matchedVideoCount: number;
  sampleVideos: DiscoverySearchVideo[];
  score: number;
  discoveredAt: string;
  searchConditions: {
    days: number;
    minVideos: number;
    queries: string[];
    publishedAfter: string;
  };
};

export type ChannelDiscoveryResult = {
  discoveredAt: string;
  searchConditions: ChannelCandidate["searchConditions"] & {
    limit: number;
  };
  candidates: ChannelCandidate[];
};

export type ChannelDiscoveryClient = {
  searchVideos(query: string, publishedAfter: string): Promise<DiscoverySearchVideo[]>;
  fetchChannelDetails(channelIds: string[]): Promise<DiscoveryChannelDetails[]>;
};

export function buildPublishedAfter(days: number, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

export function scoreChannelCandidate(input: {
  matchedVideoCount: number;
  matchedQueryCount: number;
  subscriberCount: number | null;
  latestVideoPublishedAt: string | null;
  now?: Date;
}) {
  const subscriberScore = Math.log10((input.subscriberCount ?? 0) + 1) * 3;
  const latest = input.latestVideoPublishedAt ? new Date(input.latestVideoPublishedAt).getTime() : 0;
  const nowTime = (input.now ?? new Date()).getTime();
  const daysAgo = latest > 0 ? Math.max(0, (nowTime - latest) / 86_400_000) : 60;
  const recencyScore = Math.max(0, 20 - daysAgo / 3);
  return Number(
    (input.matchedVideoCount * 20 + input.matchedQueryCount * 15 + subscriberScore + recencyScore).toFixed(3),
  );
}

export async function getRegisteredChannelIdsFromSeedAndDb() {
  const ids = new Set(SEED_CHANNELS.map((channel) => channel.youtubeChannelId).filter(Boolean));
  if (!process.env.DATABASE_URL) return ids;

  const [{ db }, { channels }] = await Promise.all([import("../database"), import("../database/schema")]);
  const rows = await db.select({ youtubeChannelId: channels.youtubeChannelId }).from(channels).where(isNotNull(channels.youtubeChannelId));
  for (const row of rows) {
    if (row.youtubeChannelId) ids.add(row.youtubeChannelId);
  }
  return ids;
}

export async function discoverChannelCandidates(
  options: ChannelDiscoveryOptions,
  client: ChannelDiscoveryClient,
  registeredChannelIds: ReadonlySet<string>,
): Promise<ChannelDiscoveryResult> {
  const queries = [...(options.queries ?? DEFAULT_CHANNEL_DISCOVERY_QUERIES)];
  const now = options.now ?? new Date();
  const discoveredAt = now.toISOString();
  const publishedAfter = buildPublishedAfter(options.days, now);
  const searchConditions = {
    days: options.days,
    minVideos: options.minVideos,
    queries,
    publishedAfter,
  };

  const grouped = new Map<
    string,
    {
      matchedQueries: Set<string>;
      videos: Map<string, DiscoverySearchVideo>;
    }
  >();

  for (const query of queries) {
    const videos = await client.searchVideos(query, publishedAfter);
    for (const video of videos) {
      if (!video.channelId || !video.videoId || registeredChannelIds.has(video.channelId)) continue;

      const group = grouped.get(video.channelId) ?? {
        matchedQueries: new Set<string>(),
        videos: new Map<string, DiscoverySearchVideo>(),
      };
      group.matchedQueries.add(query);
      group.videos.set(video.videoId, video);
      grouped.set(video.channelId, group);
    }
  }

  const eligibleChannelIds = [...grouped.entries()]
    .filter(([, group]) => group.videos.size >= options.minVideos)
    .map(([channelId]) => channelId);

  const details = await client.fetchChannelDetails(eligibleChannelIds);
  const detailsById = new Map(details.map((detail) => [detail.channelId, detail]));

  const candidates = eligibleChannelIds
    .map((channelId) => {
      const group = grouped.get(channelId);
      if (!group) return null;

      const sampleVideos = [...group.videos.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 5);
      const detail = detailsById.get(channelId) ?? fallbackChannelDetails(channelId, sampleVideos[0]?.channelTitle ?? null);
      const score = scoreChannelCandidate({
        matchedVideoCount: group.videos.size,
        matchedQueryCount: group.matchedQueries.size,
        subscriberCount: detail.subscriberCount,
        latestVideoPublishedAt: sampleVideos[0]?.publishedAt ?? null,
        now,
      });

      return {
        ...detail,
        matchedQueries: [...group.matchedQueries].sort(),
        matchedVideoCount: group.videos.size,
        sampleVideos,
        score,
        discoveredAt,
        searchConditions,
      };
    })
    .filter((candidate): candidate is ChannelCandidate => candidate !== null)
    .sort((a, b) => b.score - a.score || b.matchedVideoCount - a.matchedVideoCount || a.title.localeCompare(b.title))
    .slice(0, options.limit);

  return {
    discoveredAt,
    searchConditions: {
      ...searchConditions,
      limit: options.limit,
    },
    candidates,
  };
}

export class YoutubeChannelDiscoveryClient implements ChannelDiscoveryClient {
  constructor(private readonly apiKey = process.env.YOUTUBE_API_KEY) {}

  async searchVideos(query: string, publishedAfter: string): Promise<DiscoverySearchVideo[]> {
    if (!this.apiKey) throw new Error("YOUTUBE_API_KEY is not set");
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      order: "date",
      maxResults: "50",
      q: query,
      publishedAfter,
      key: this.apiKey,
    });
    const data = await withYoutubeRetry(() => youtubeJson(`${YT_API_BASE}/search?${params}`, `video search for ${query}`));
    return (data.items ?? []).flatMap(mapSearchVideoItem);
  }

  async fetchChannelDetails(channelIds: string[]): Promise<DiscoveryChannelDetails[]> {
    if (!this.apiKey) throw new Error("YOUTUBE_API_KEY is not set");
    const results: DiscoveryChannelDetails[] = [];
    for (const batch of chunkArray(channelIds, 50)) {
      if (batch.length === 0) continue;
      const params = new URLSearchParams({
        part: "snippet,statistics",
        id: batch.join(","),
        key: this.apiKey,
      });
      const data = await withYoutubeRetry(() => youtubeJson(`${YT_API_BASE}/channels?${params}`, "channel discovery details lookup"));
      for (const item of data.items ?? []) {
        results.push(mapChannelDetailsItem(item));
      }
    }
    return results;
  }
}

async function youtubeJson(url: string, operation: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new Error(`YouTube API ${operation} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSearchVideoItem(item: any): DiscoverySearchVideo[] {
  const videoId = item.id?.videoId;
  const channelId = item.snippet?.channelId;
  if (!videoId || !channelId) return [];
  return [
    {
      videoId,
      channelId,
      channelTitle: item.snippet?.channelTitle ?? null,
      title: item.snippet?.title ?? "",
      publishedAt: item.snippet?.publishedAt ?? "",
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    },
  ];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChannelDetailsItem(item: any): DiscoveryChannelDetails {
  const statistics = item.statistics ?? {};
  return {
    channelId: item.id,
    title: item.snippet?.title ?? "Unknown",
    channelUrl: `https://www.youtube.com/channel/${item.id}`,
    thumbnailUrl: selectChannelThumbnailUrl(item.snippet?.thumbnails),
    subscriberCount: statistics.hiddenSubscriberCount ? null : optionalNumber(statistics.subscriberCount),
    viewCount: optionalNumber(statistics.viewCount) ?? 0,
    videoCount: optionalNumber(statistics.videoCount) ?? 0,
    publishedAt: item.snippet?.publishedAt ?? null,
    description: item.snippet?.description ?? "",
  };
}

function fallbackChannelDetails(channelId: string, title: string | null): DiscoveryChannelDetails {
  return {
    channelId,
    title: title ?? "Unknown",
    channelUrl: `https://www.youtube.com/channel/${channelId}`,
    thumbnailUrl: null,
    subscriberCount: null,
    viewCount: 0,
    videoCount: 0,
    publishedAt: null,
    description: "",
  };
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
