import { classifyVideoContent, type VideoContentClassification } from "./content-type";

export type BackfillVideoRow = {
  videoId: string;
  title: string;
  durationSeconds: number | null;
  liveBroadcastContent: string | null;
  channelCategory?: Parameters<typeof classifyVideoContent>[0]["channelCategory"];
};

export type BackfillVideoMetadata = {
  videoId: string;
  durationSeconds: number | null;
  liveBroadcastContent: string | null;
};

export type VideoMetadataBackfillUpdate = {
  videoId: string;
  durationSeconds: number | null;
  liveBroadcastContent: string | null;
  classification: VideoContentClassification;
};

export function needsYoutubeMetadataBackfill(video: BackfillVideoRow) {
  return video.durationSeconds === null || video.liveBroadcastContent === null;
}

export function buildVideoMetadataBackfillUpdates(
  videos: readonly BackfillVideoRow[],
  fetchedMetadata: readonly BackfillVideoMetadata[],
) {
  const metadataByVideoId = new Map(fetchedMetadata.map((metadata) => [metadata.videoId, metadata]));
  const updates: VideoMetadataBackfillUpdate[] = [];
  const failedVideoIds: string[] = [];

  for (const video of videos) {
    if (!needsYoutubeMetadataBackfill(video)) {
      const classification = classifyVideoContent({
        title: video.title,
        durationSeconds: video.durationSeconds,
        liveBroadcastContent: video.liveBroadcastContent,
        channelCategory: video.channelCategory,
      });
      updates.push({
        videoId: video.videoId,
        durationSeconds: video.durationSeconds,
        liveBroadcastContent: video.liveBroadcastContent,
        classification,
      });
      continue;
    }

    const metadata = metadataByVideoId.get(video.videoId);
    if (!metadata) {
      failedVideoIds.push(video.videoId);
      continue;
    }

    const classification = classifyVideoContent({
      title: video.title,
      durationSeconds: metadata.durationSeconds,
      liveBroadcastContent: metadata.liveBroadcastContent,
      channelCategory: video.channelCategory,
    });
    updates.push({
      videoId: video.videoId,
      durationSeconds: metadata.durationSeconds,
      liveBroadcastContent: metadata.liveBroadcastContent,
      classification,
    });
  }

  return { updates, failedVideoIds };
}
