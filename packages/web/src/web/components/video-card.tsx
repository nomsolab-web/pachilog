import { Eye, ExternalLink } from "lucide-react";
import { ChannelAvatar } from "./channel-avatar";

type Props = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  channelName?: string | null;
  channelThumbnailUrl?: string | null;
  metric?: string;
};

export function VideoCard({
  videoId,
  title,
  thumbnailUrl,
  publishedAt,
  viewCount,
  channelName,
  channelThumbnailUrl,
  metric,
}: Props) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const imageUrl = thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <article className="interactive-card overflow-hidden rounded-xl border">
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} をYouTubeで見る`}
        className="block"
      >
        <img src={imageUrl} alt="" loading="lazy" className="aspect-video w-full object-cover bg-secondary" />
      </a>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-11 font-semibold leading-snug">{title}</h3>
        {channelName && (
          <div className="mt-3 flex items-center gap-2">
            <ChannelAvatar name={channelName} thumbnailUrl={channelThumbnailUrl ?? null} className="size-8 rounded-full" />
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{channelName}</p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{formatDate(publishedAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {viewCount.toLocaleString("ja-JP")}回
          </span>
          {metric && <span className="font-semibold text-info">{metric}</span>}
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          YouTubeで見る
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </article>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date);
}
