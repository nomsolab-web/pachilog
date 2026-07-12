import { Link } from "wouter";
import { ArrowDown, ArrowUp, Users } from "lucide-react";

type Props = {
  rank: number;
  id: number;
  name: string;
  thumbnailUrl: string | null;
  latestSubscriberCount: number;
  delta: number;
  deltaPct: number;
};

export function RankingCard({ rank, id, name, thumbnailUrl, latestSubscriberCount, delta, deltaPct }: Props) {
  const rising = delta >= 0;
  return (
    <Link
      to={`/channels/${id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-[var(--secondary)] transition-colors"
    >
      <span className="font-display font-bold text-muted-foreground w-6 text-center">{rank}</span>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={name} className="size-11 rounded-full object-cover" />
      ) : (
        <div className="size-11 rounded-full bg-secondary flex items-center justify-center">
          <Users className="size-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-display flex items-center gap-1">
          <Users className="size-3" />
          {latestSubscriberCount.toLocaleString()}人
        </p>
      </div>
      <div
        className={`flex items-center gap-1 font-display font-semibold text-sm px-2 py-1 rounded-lg ${
          rising ? "text-rise bg-rise/10" : "text-fall bg-fall/10"
        }`}
      >
        {rising ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
        {Math.abs(deltaPct).toFixed(1)}%
      </div>
    </Link>
  );
}
