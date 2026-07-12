import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
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

  return (
    <div>
      <section className="mb-10">
        <h1 className="font-display font-extrabold text-3xl mb-2">
          パチスロ系YouTuber、<span className="text-gold">今</span>伸びてるのは？
        </h1>
        <p className="text-muted-foreground">
          チャンネル登録者数・再生数の推移を毎日自動収集。攻略・期待値は扱いません。
        </p>
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
              急降下
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
            まだデータが十分に溜まっていません。収集が進むとここにランキングが表示されます。
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Index;
