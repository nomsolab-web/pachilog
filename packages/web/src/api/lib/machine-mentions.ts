export type MachineMentionStats = {
  videoTitle: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
};

export function shouldSyncMachineMention(existing: MachineMentionStats, next: MachineMentionStats) {
  return (
    existing.videoTitle !== next.videoTitle ||
    existing.viewCount !== next.viewCount ||
    existing.likeCount !== next.likeCount ||
    existing.commentCount !== next.commentCount ||
    existing.publishedAt !== next.publishedAt
  );
}
