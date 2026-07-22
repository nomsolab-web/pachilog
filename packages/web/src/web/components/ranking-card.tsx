import { Link } from "wouter";
import { ArrowDown, ArrowUp, Minus, Users, Youtube } from "lucide-react";
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
  const youtubeUrl = getYouTubeChannelUrl({ handle, youtubeChannelId });
  const trendType = !hasTrend
    ? "none"
    : delta > 0
    ? "up"
    : delta < 0
    ? "down"
    : "flat";

  const trendClass = trendType === "up"
    ? "text-rise bg-rise/10 border border-rise/20"
    : trendType === "down"
    ? "text-fall bg-fall/10 border border-fall/20"
    : trendType === "flat"
    ? "text-muted-foreground bg-secondary/80 border border-border"
    : "info-badge";

  const formattedDelta = delta > 0
    ? `+${formatJapaneseCount(delta, "人")}`
    : delta < 0
    ? `${formatJapaneseCount(delta, "人")}`
    : "±0人";

  const formattedPct = delta > 0
    ? `+${deltaPct.toFixed(1)}%`
    : delta < 0
    ? `${deltaPct.toFixed(1)}%`
    : "0.0%";

  return (
    <div className="interactive-card flex items-center gap-3 rounded-xl border px-3 sm:px-4 py-3">
      <Link to={`/channels/${id}`} className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <span className="font-display font-bold text-sm text-info bg-info/10 border border-info/30 rounded-lg w-8 h-8 flex items-center justify-center shrink-0">
          {rank}
        </span>
        <ChannelAvatar name={name} thumbnailUrl={thumbnailUrl} className="size-11 sm:size-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm sm:text-base truncate">{name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground font-display mt-0.5">
            <span className="inline-flex items-center gap-1">
              <Users className="size-3 shrink-0" />
              <span>{formatJapaneseCount(latestSubscriberCount, "人")}</span>
            </span>
            {isProvisional && <span className="text-info shrink-0">暫定集計{comparisonDays}日目</span>}
          </div>
        </div>
      </Link>
      <div className={`flex shrink-0 flex-col items-end justify-center px-2.5 py-1.5 rounded-lg font-display ${trendClass}`}>
        {hasTrend ? (
          <>
            <div className="flex items-center gap-1 font-bold text-xs sm:text-sm">
              {trendType === "up" && <ArrowUp className="size-3.5 shrink-0" />}
              {trendType === "down" && <ArrowDown className="size-3.5 shrink-0" />}
              {trendType === "flat" && <Minus className="size-3.5 shrink-0 text-muted-foreground" />}
              <span>{formattedDelta}</span>
            </div>
            <div className="text-[11px] sm:text-xs font-semibold opacity-90">
              {formattedPct}
            </div>
          </>
        ) : (
          <span className="text-xs font-bold">データ蓄積中</span>
        )}
      </div>
      {youtubeUrl && (
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} をYouTubeで開く`}
          className="flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:border-gold/60 hover:text-gold"
        >
          <Youtube className="size-4" />
        </a>
      )}
    </div>
  );
}
