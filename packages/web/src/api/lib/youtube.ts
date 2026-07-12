const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  return key;
}

export type YoutubeChannelStats = {
  channelId: string;
  name: string;
  thumbnailUrl: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
};

export async function fetchChannelByHandle(handle: string): Promise<YoutubeChannelStats | null> {
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  const url = `${YT_API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`YouTube API error for handle ${cleanHandle}: ${res.status} ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;
  return mapChannelItem(item);
}

export async function fetchChannelsByIds(channelIds: string[]): Promise<YoutubeChannelStats[]> {
  const results: YoutubeChannelStats[] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const batch = channelIds.slice(i, i + 50);
    const url = `${YT_API_BASE}/channels?part=snippet,statistics&id=${batch.join(",")}&key=${apiKey()}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`YouTube API error for batch: ${res.status} ${await res.text()}`);
      continue;
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      results.push(mapChannelItem(item));
    }
  }
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
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

export async function fetchRecentVideos(playlistId: string, maxResults = 25): Promise<RecentVideo[]> {
  const url = `${YT_API_BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
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
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
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
