type YouTubeChannelRef = {
  handle?: string | null;
  youtubeChannelId?: string | null;
};

export function getYouTubeChannelUrl(channel: YouTubeChannelRef) {
  if (channel.handle) {
    const handle = channel.handle.startsWith("@") ? channel.handle : `@${channel.handle}`;
    return `https://www.youtube.com/${handle}`;
  }

  if (channel.youtubeChannelId) {
    return `https://www.youtube.com/channel/${channel.youtubeChannelId}`;
  }

  return null;
}
