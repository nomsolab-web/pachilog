import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Search, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { formatJapaneseDate } from "../lib/format";
import { RankingCard } from "../components/ranking-card";
import { VideoCard } from "../components/video-card";

const PERIODS = [
  { label: "7日", value: 7 },
  { label: "30日", value: 30 },
  { label: "90日", value: 90 },
] as const;

const CATEGORY_OPTIONS = [
  { label: "すべて", value: "all" },
  { label: "媒体", value: "media" },
  { label: "演者", value: "performer" },
  { label: "個人", value: "individual" },
  { label: "メーカー", value: "manufacturer" },
  { label: "ホール", value: "hall" },
  { label: "その他", value: "other" },
] as const;

function Index() {
  const [period, setPeriod] = useState<7 | 30 | 90>(7);
  const [tab, setTab] = useState<"rising" | "falling">("rising");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("all");

  const rankings = useQuery({
    queryKey: ["rankings", period],
    queryFn: async () => (await api.rankings.$get({ query: { period: String(period) } })).json(),
  });
  const trendingVideos = useQuery({
    queryKey: ["videos-trending", "previous", "top"],
    queryFn: async () => (await api.videos.trending.$get({ query: { mode: "previous" } })).json(),
  });

  const list = rankings.data ? (tab === "rising" ? rankings.data.rising : rankings.data.falling) : [];
  const visibleList = list
    .filter((entry) => (category === "all" ? true : entry.category === category))
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 50);
  const latestDate = useMemo(() => {
    if (!rankings.data) return null;
    const all = [...rankings.data.rising, ...rankings.data.falling].map((entry) => entry.latestDate).filter(Boolean);
    return all.sort().at(-1) ?? null;
  }, [rankings.data]);

  return (
    <div>
      <section className="site-hero rounded-2xl px-5 py-6 mb-10 sm:px-7 sm:py-8">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mb-3">
          パチンコパチスロ系YouTuber、今伸びてるのは？
        </h1>
        <p className="text-muted-foreground max-w-3xl leading-7">
          チャンネル登録者数と再生数の推移を毎日自動で集計し、直近の伸びをランキング化しています。期待値や攻略情報ではなく、公開データの変化だけを扱います。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            最終更新日: {formatJapaneseDate(latestDate)}
          </span>
          <Link to="/methodology" className="text-gold hover:text-gold/80 transition-colors">
            ランキングの集計方法
          </Link>
          <Link to="/channels" className="text-info hover:text-info/80 transition-colors">
            全チャンネル一覧
          </Link>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-xl">前回収集から伸びた動画</h2>
          <Link to="/videos/trending" className="text-sm text-gold hover:text-gold/80">
            もっと見る
          </Link>
        </div>
        {trendingVideos.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-64 rounded-xl border surface-card animate-pulse" />
            ))}
          </div>
        ) : (trendingVideos.data?.videos ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border surface-card px-5 py-10 text-center text-sm text-muted-foreground">
            動画履歴を蓄積中です。
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(trendingVideos.data?.videos ?? []).slice(0, 5).map((video) => (
              <VideoCard
                key={video.videoId}
                videoId={video.videoId}
                title={video.title}
                thumbnailUrl={video.thumbnailUrl}
                publishedAt={video.publishedAt}
                viewCount={video.currentViewCount}
                channelName={video.channelName}
                channelThumbnailUrl={video.channelThumbnailUrl}
                metric={video.hasTrend ? `+${video.viewDelta.toLocaleString("ja-JP")}回` : "データ蓄積中"}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="segmented-control flex gap-1 rounded-lg border p-1">
            <button
              onClick={() => setTab("rising")}
              className={`segmented-button flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold ${
                tab === "rising" ? "segmented-button-active bg-rise/15 text-rise" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="size-4" />
              急上昇
            </button>
            <button
              onClick={() => setTab("falling")}
              className={`segmented-button flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold ${
                tab === "falling" ? "segmented-button-active bg-fall/15 text-fall" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingDown className="size-4" />
              急下降
            </button>
          </div>

          <div className="segmented-control flex gap-1 rounded-lg border p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
                  period === p.value ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 mb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-2 rounded-xl border surface-card px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="チャンネル名で検索"
              aria-label="チャンネル名で検索"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="segmented-control flex gap-1 rounded-lg border p-1 overflow-x-auto">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setCategory(option.value)}
                className={`segmented-button shrink-0 px-3 py-1.5 rounded-md text-sm font-semibold ${
                  category === option.value ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {rankings.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl border surface-card animate-pulse" />
            ))}
          </div>
        ) : visibleList.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl surface-card">
            まだランキングに必要なデータがありません。収集が進むとここに表示されます。
          </div>
        ) : (
          <div className="space-y-2">
            {visibleList.map((entry, i) => (
              <RankingCard
                key={entry.id}
                rank={i + 1}
                id={entry.id}
                name={entry.name}
                handle={entry.handle}
                youtubeChannelId={entry.youtubeChannelId}
                thumbnailUrl={entry.thumbnailUrl}
                latestSubscriberCount={entry.latestSubscriberCount}
                delta={entry.delta}
                deltaPct={entry.deltaPct}
                snapshotCount={entry.snapshotCount}
                comparisonDays={entry.comparisonDays}
                isProvisional={entry.isProvisional}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Index;
