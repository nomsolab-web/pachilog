import { Eye, ExternalLink } from "lucide-react";
import { ChannelAvatar } from "./channel-avatar";
import { type VideoContentTypeValue } from "../lib/video-content-types";

export type VideoType = Exclude<VideoContentTypeValue, "unknown">;

export function getVideoType(title: string, channelName?: string | null): VideoType {
  const t = title.toLowerCase();
  const ch = channelName ? channelName.toLowerCase() : "";

  if (t.includes("#shorts") || t.includes("shorts") || t.includes("ショート")) {
    return "short";
  }

  if (t.includes("live") || t.includes("生放送") || t.includes("生配信") || t.includes("生実機") || t.includes("ライブ") || t.includes("生スト")) {
    return "live";
  }

  const isManufacturer = [
    "sankyo", "sammy", "サミー", "三洋", "ユニバーサル", "ニューギン", "オリンピア", "平和", "藤商事", 
    "kyoraku", "京楽", "ビスティ", "ジェイビー", "コナミ", "大都", "pioneer", "パイオニア"
  ].some(m => ch.includes(m));

  if (isManufacturer || t.includes("pv") || t.includes("cm") || t.includes("ティザー") || t.includes("特別映像") || t.includes("公式映像") || t.includes("プロモーション") || t.includes("最速試打")) {
    return "promotion";
  }

  return "standard";
}

type Props = {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  channelName?: string | null;
  channelThumbnailUrl?: string | null;
  metric?: string;
  contentType?: VideoContentTypeValue | null;
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
  contentType,
}: Props) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const imageUrl = thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const videoType = contentType ?? getVideoType(title, channelName);
  const showBadge = videoType !== "standard";
  const typeBadge = videoType === "unknown"
    ? { label: "その他", className: "bg-zinc-800 text-zinc-300 border border-zinc-700/50" }
    : ({
        short: { label: "ショート", className: "bg-red-600 text-white border border-red-500/30" },
        live: { label: "ライブ", className: "bg-rose-600 text-white border border-rose-500/30 animate-pulse-subtle" },
        promotion: { label: "公式PV・CM", className: "bg-gold text-black font-extrabold border border-gold/20" },
        standard: { label: "", className: "" }
      } as const)[videoType];

  return (
    <article className="interactive-card overflow-hidden rounded-xl border">
      <div className="relative aspect-video w-full overflow-hidden bg-secondary">
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title} をYouTubeで見る`}
          className="block w-full h-full"
        >
          <img src={imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        </a>
        {showBadge && (
          <span className={`absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded font-semibold tracking-wider backdrop-blur-sm shadow-md z-10 ${typeBadge.className}`}>
            {typeBadge.label}
          </span>
        )}
      </div>
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
