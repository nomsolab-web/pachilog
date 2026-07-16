import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { formatJapaneseDate } from "../lib/format";
import { RankingCard } from "../components/ranking-card";

const PERIODS = [
  { label: "7日", value: 7 },
  { label: "30日", value: 30 },
  { label: "90日", value: 90 },
] as const;

function Index() {
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [tab, setTab] = useState<"rising" | "falling">("rising");

  const rankings = useQuery({
    queryKey: ["rankings", period],
    queryFn: async () => (await api.rankings.$get({ query: { period: String(period) } })).json(),
  });

  const list = rankings.data ? (tab === "rising" ? rankings.data.rising : rankings.data.falling) : [];
  const latestDate = useMemo(() => {
    if (!rankings.data) return null;
    const all = [...rankings.data.rising, ...rankings.data.falling].map((entry) => entry.latestDate).filter(Boolean);
    return all.sort().at(-1) ?? null;
  }, [rankings.data]);

  return (
    <div>
      <section className="mb-10">
        <h1 className="font-display font-extrabold text-3xl mb-3">
          パチンコパチスロ系YouTuber、今伸びてるのは？
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          チャンネル登録者数と再生数の推移を毎日自動で集計し、直近の伸びをランキング化しています。期待値や攻略情報ではなく、公開データの変化だけを扱います。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            最終更新日: {formatJapaneseDate(latestDate)}
          </span>
          <Link to="/methodology" className="text-gold hover:text-gold/80 transition-colors">
            ランキングの集計方法
          </Link>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex gap-1 rounded-lg border border-border p-1 bg-card">
            <button
              onClick={() => setTab("rising")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "rising" ? "bg-rise/15 text-rise" : "text-muted-foreground"
              }`}
            >
              <TrendingUp className="size-4" />
              急上昇
            </button>
            <button
              onClick={() => setTab("falling")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === "falling" ? "bg-fall/15 text-fall" : "text-muted-foreground"
              }`}
            >
              <TrendingDown className="size-4" />
              急下降
            </button>
          </div>

          <div className="flex gap-1 rounded-lg border border-border p-1 bg-card">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  period === p.value ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {rankings.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
            まだランキングに必要なデータがありません。収集が進むとここに表示されます。
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((entry, i) => (
              <RankingCard
                key={entry.id}
                rank={i + 1}
                id={entry.id}
                name={entry.name}
                thumbnailUrl={entry.thumbnailUrl}
                latestSubscriberCount={entry.latestSubscriberCount}
                delta={entry.delta}
                deltaPct={entry.deltaPct}
                snapshotCount={entry.snapshotCount}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Index;
