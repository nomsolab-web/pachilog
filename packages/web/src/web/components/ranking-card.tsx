import { Link } from "wouter";
import { ArrowDown, ArrowUp, Users, Youtube } from "lucide-react";
import { formatJapaneseCount } from "../lib/format";
import { getYouTubeChannelUrl } from "../lib/youtube";
import { ChannelAvatar } from "./channel-avatar";

type Props = {
  rank: number;
  id: number;
  name: string;
  handle?: string | null;
  youtubeChannelId?: string | null;
  thumbnailUrl: string | null;
  latestSubscriberCount: number;
  delta: number;
  deltaPct: number;
  snapshotCount: number;
  comparisonDays: number;
  isProvisional: boolean;
};

export function RankingCard({
  rank,
  id,
  name,
  handle,
  youtubeChannelId,
  thumbnailUrl,
  latestSubscriberCount,
  delta,
  deltaPct,
  snapshotCount,
  comparisonDays,
  isProvisional,
}: Props) {
  const hasTrend = snapshotCount > 1;
  const rising = delta >= 0;
  const youtubeUrl = getYouTubeChannelUrl({ handle, youtubeChannelId });
  const trendClass = hasTrend
    ? rising
      ? "text-rise bg-rise/10"
      : "text-fall bg-fall/10"
    : "info-badge";

  return (
    <div className="interactive-card flex items-center gap-3 rounded-xl border px-4 py-3">
      <Link to={`/channels/${id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-display font-bold text-sm text-info bg-info/10 border border-info/30 rounded-lg w-8 h-8 flex items-center justify-center shrink-0">
          {rank}
        </span>
        <ChannelAvatar name={name} thumbnailUrl={thumbnailUrl} className="size-12 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground font-display flex items-center gap-1 mt-0.5">
            <Users className="size-3" />
            {formatJapaneseCount(latestSubscriberCount, "人")}
          </p>
          {isProvisional && <p className="text-xs text-info mt-1">暫定集計{comparisonDays}日目</p>}
        </div>
      </Link>
      <div className={`flex shrink-0 items-center gap-1 font-display font-bold text-sm px-2.5 py-1.5 rounded-lg ${trendClass}`}>
        {hasTrend ? (
          <>
            {rising ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
            {Math.abs(deltaPct).toFixed(1)}%
          </>
        ) : (
          "データ蓄積中"
        )}
      </div>
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} をYouTubeで開く`}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:border-gold/60 hover:text-gold"
        >
          <Youtube className="size-4" />
        </a>
      )}
    </div>
  );
}
