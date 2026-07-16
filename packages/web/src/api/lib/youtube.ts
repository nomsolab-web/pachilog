const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function youtubeJson(url: string, operation: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 500);
    throw new YoutubeApiError(`YouTube API ${operation} failed (${res.status}): ${detail}`, res.status);
  }
  return res.json();
}

export type YoutubeChannelStats = {
  channelId: string;
  name: string;
  thumbnailUrl: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
};

export type BatchResult<T> = {
  items: T[];
  errors: string[];
};

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

export function isRetryableYoutubeError(error: unknown) {
  return error instanceof YoutubeApiError && RETRY_STATUSES.has(error.status);
}

export async function withYoutubeRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!isRetryableYoutubeError(err) || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

export function isSuccessfulCollectionRate(fetched: number, requested: number, threshold = 0.95) {
  if (requested === 0) return false;
  return fetched / requested >= threshold;
}

export async function fetchChannelByHandle(handle: string): Promise<YoutubeChannelStats | null> {
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const url = `${YT_API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey()}`;
  const data = await withYoutubeRetry(() => youtubeJson(url, `channel lookup for ${cleanHandle}`));
  const item = data.items?.[0];
  if (!item) return null;
  return mapChannelItem(item);
}

export async function fetchChannelsByIdsSafe(channelIds: string[]): Promise<BatchResult<YoutubeChannelStats>> {
  const results: YoutubeChannelStats[] = [];
  const errors: string[] = [];
  for (const batch of chunkArray(channelIds, 50)) {
    const url = `${YT_API_BASE}/channels?part=snippet,statistics&id=${batch.join(",")}&key=${apiKey()}`;
    try {
      const data = await withYoutubeRetry(() => youtubeJson(url, "channel statistics lookup"));
      for (const item of data.items ?? []) {
        results.push(mapChannelItem(item));
      }
    } catch (err) {
      errors.push(`channel batch ${batch[0]}..${batch[batch.length - 1]}: ${(err as Error).message}`);
    }
  }
  return { items: results, errors };
}

export async function fetchChannelsByIds(channelIds: string[]): Promise<YoutubeChannelStats[]> {
  const result = await fetchChannelsByIdsSafe(channelIds);
  return result.items;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export type RecentVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
};

export type VideoStats = {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export async function fetchUploadsPlaylistId(channelId: string): Promise<string | null> {
  const url = `${YT_API_BASE}/channels?part=contentDetails&id=${channelId}&key=${apiKey()}`;
  const data = await withYoutubeRetry(() => youtubeJson(url, "uploads playlist lookup"));
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

export async function fetchRecentVideos(playlistId: string, maxResults = 25): Promise<RecentVideo[]> {
  const url = `${YT_API_BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey()}`;
  const data = await withYoutubeRetry(() => youtubeJson(url, "recent videos lookup"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    videoId: item.snippet?.resourceId?.videoId,
    title: item.snippet?.title ?? "",
    publishedAt: item.snippet?.publishedAt ?? null,
  }));
}

export async function fetchVideoStats(videoIds: string[]): Promise<VideoStats[]> {
  const results: VideoStats[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = `${YT_API_BASE}/videos?part=statistics&id=${batch.join(",")}&key=${apiKey()}`;
    const data = await withYoutubeRetry(() => youtubeJson(url, "video statistics lookup"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of data.items ?? []) {
      results.push({
        videoId: item.id,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
      });
    }
  }
  return results;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapChannelItem(item: any): YoutubeChannelStats {
  return {
    channelId: item.id,
    name: item.snippet?.title ?? "Unknown",
    thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    subscriberCount: Number(item.statistics?.subscriberCount ?? 0),
    viewCount: Number(item.statistics?.viewCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
  };
}
