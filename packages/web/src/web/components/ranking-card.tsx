import { Link } from "wouter";
import { ArrowDown, ArrowUp, Users } from "lucide-react";
import { formatJapaneseCount } from "../lib/format";

type Props = {
  rank: number;
  id: number;
  name: string;
  thumbnailUrl: string | null;
  latestSubscriberCount: number;
  delta: number;
  deltaPct: number;
  snapshotCount: number;
};

export function RankingCard({ rank, id, name, thumbnailUrl, latestSubscriberCount, delta, deltaPct, snapshotCount }: Props) {
  const hasTrend = snapshotCount > 1;
  const rising = delta >= 0;
  const trendClass = hasTrend
    ? rising
      ? "text-rise bg-rise/10"
      : "text-fall bg-fall/10"
    : "info-badge";

  return (
    <Link to={`/channels/${id}`} className="interactive-card flex items-center gap-3 rounded-xl border px-4 py-3">
      <span className="font-display font-bold text-sm text-info bg-info/10 border border-info/30 rounded-lg w-8 h-8 flex items-center justify-center shrink-0">
        {rank}
      </span>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={name} className="size-12 rounded-full object-cover border border-border/80" />
      ) : (
        <div className="size-12 rounded-full bg-secondary border border-border/80 flex items-center justify-center">
          <Users className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-display flex items-center gap-1 mt-0.5">
          <Users className="size-3" />
          {formatJapaneseCount(latestSubscriberCount, "人")}
        </p>
      </div>
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
    </Link>
  );
}
