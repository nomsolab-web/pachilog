export const DEFAULT_VIDEO_TRACKING_DAYS = 60;
export const DEFAULT_VIDEO_TRACKING_MAX = 5000;
export const YOUTUBE_VIDEO_BATCH_SIZE = 50;

export type TrackableVideo = {
  videoId: string;
  publishedAt: string | null;
  updatedAt: Date | string | number;
  channelId: number;
};

export function selectTrackedVideoIds(
  videos: readonly TrackableVideo[],
  activeChannelIds: ReadonlySet<number>,
  now: Date,
  trackingDays = DEFAULT_VIDEO_TRACKING_DAYS,
  maxVideos = DEFAULT_VIDEO_TRACKING_MAX,
  excludedIds: ReadonlySet<string> = new Set(),
) {
  const cutoff = now.getTime() - trackingDays * 24 * 60 * 60 * 1000;
  return videos
    .filter((video) => {
      const published = video.publishedAt ? Date.parse(video.publishedAt) : NaN;
      return activeChannelIds.has(video.channelId) && Number.isFinite(published) && published >= cutoff && !excludedIds.has(video.videoId);
    })
    .sort((a, b) => timestamp(a.updatedAt) - timestamp(b.updatedAt) || a.videoId.localeCompare(b.videoId))
    .slice(0, maxVideos)
    .map((video) => video.videoId);
}

export function batchVideoIds(videoIds: readonly string[], batchSize = YOUTUBE_VIDEO_BATCH_SIZE) {
  const batches: string[][] = [];
  for (let index = 0; index < videoIds.length; index += batchSize) batches.push(videoIds.slice(index, index + batchSize));
  return batches;
}

function timestamp(value: Date | string | number) {
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
