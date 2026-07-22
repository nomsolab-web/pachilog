import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Search, TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<"count" | "rate">("count");
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
  const machines = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await api.machines.$get()).json(),
  });

  const list = useMemo(() => {
    if (!rankings.data) return [];
    const baseList = tab === "rising" ? [...rankings.data.rising] : [...rankings.data.falling];
    
    return baseList.sort((a, b) => {
      if (tab === "rising") {
        if (sortBy === "count") {
          return b.delta - a.delta || a.name.localeCompare(b.name, "ja");
        }
        return b.deltaPct - a.deltaPct || b.delta - a.delta || a.name.localeCompare(b.name, "ja");
      } else {
        if (sortBy === "count") {
          return a.delta - b.delta || a.name.localeCompare(b.name, "ja");
        }
        return a.deltaPct - b.deltaPct || a.delta - b.delta || a.name.localeCompare(b.name, "ja");
      }
    });
  }, [rankings.data, tab, sortBy]);

  const visibleList = list
    .filter((entry) => (category === "all" ? true : entry.category === category))
    .filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 5); // Limit to top 5 on homepage for above-the-fold visibility

  const latestDate = useMemo(() => {
    if (!rankings.data) return null;
    const all = [...rankings.data.rising, ...rankings.data.falling].map((entry) => entry.latestDate).filter(Boolean);
    return all.sort().at(-1) ?? null;
  }, [rankings.data]);

  const trendingMachinesList = useMemo(() => {
    if (!machines.data || !("machines" in machines.data)) return [];
    return [...machines.data.machines]
      .sort((a, b) => (b.recentViews ?? 0) - (a.recentViews ?? 0))
      .slice(0, 5);
  }, [machines.data]);

  return (
    <div className="space-y-12">
      {/* 1. Compact description hero */}
      <section className="site-hero rounded-2xl px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-2xl mb-1">パチパルス！</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            パチンコパチスロ系YouTube動画、チャンネル、新台の伸びを毎日集計するデータメディアです。
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 bg-background/30 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border/40">
          <CalendarDays className="size-3.5 text-gold" />
          <span>最終更新: {formatJapaneseDate(latestDate)}</span>
        </div>
      </section>

      {/* SECTION 1: 今日伸びた動画 */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/40 pb-2">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-gold/10 text-gold text-xs font-bold font-display">1</span>
            今日伸びた動画
          </h2>
          <Link to="/videos/trending" className="text-xs text-gold hover:text-gold/80 flex items-center gap-1">
            もっと見る <ArrowRight className="size-3" />
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

      {/* SECTION 2: 今週伸びたチャンネル */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-info/10 text-info text-xs font-bold font-display">2</span>
            今週伸びたチャンネル
          </h2>
          <Link to="/channels" className="text-xs text-info hover:text-info/80 flex items-center gap-1">
            全チャンネル一覧 <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented-control flex gap-1 rounded-lg border p-1 bg-background/50">
              <button
                onClick={() => setTab("rising")}
                className={`segmented-button flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                  tab === "rising" ? "segmented-button-active bg-rise/15 text-rise" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingUp className="size-3.5" />
                登録者増加
              </button>
              <button
                onClick={() => setTab("falling")}
                className={`segmented-button flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
                  tab === "falling" ? "segmented-button-active bg-fall/15 text-fall" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TrendingDown className="size-3.5" />
                登録者減少
              </button>
            </div>

            <div className="segmented-control flex gap-1 rounded-lg border p-1 bg-background/50">
              <button
                onClick={() => setSortBy("count")}
                className={`segmented-button px-3 py-1.5 rounded-md text-xs font-semibold ${
                  sortBy === "count" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                増加数順
              </button>
              <button
                onClick={() => setSortBy("rate")}
                className={`segmented-button px-3 py-1.5 rounded-md text-xs font-semibold ${
                  sortBy === "rate" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                伸び率順
              </button>
            </div>
          </div>

          <div className="segmented-control flex gap-1 rounded-lg border p-1 bg-background/50">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`segmented-button px-3 py-1.5 rounded-md text-xs font-semibold ${
                  period === p.value ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 mb-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-2 rounded-xl border surface-card px-3 py-1.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="チャンネル名で検索"
              aria-label="チャンネル名で検索"
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="segmented-control flex gap-1 rounded-lg border p-1 overflow-x-auto bg-background/50">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setCategory(option.value)}
                className={`segmented-button shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold ${
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
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] rounded-xl border surface-card animate-pulse" />
            ))}
          </div>
        ) : visibleList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl surface-card text-sm">
            データがありません。絞り込み条件を変えてみてください。
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

      {/* SECTION 3: 今バズっている新台 */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/40 pb-2">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-gold/10 text-gold text-xs font-bold font-display">3</span>
            今バズっている新台
          </h2>
          <Link to="/machines" className="text-xs text-gold hover:text-gold/80 flex items-center gap-1">
            もっと見る <ArrowRight className="size-3" />
          </Link>
        </div>
        {machines.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 rounded-xl border surface-card animate-pulse" />
            ))}
          </div>
        ) : machines.isError || !machines.data ? (
          <div className="text-center py-10 text-muted-foreground text-sm">新台情報を取得できませんでした。</div>
        ) : trendingMachinesList.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl text-sm">
            バズっている新台がありません。
          </div>
        ) : (
          <div className="space-y-2">
            {trendingMachinesList.map((machine, index) => (
              <Link
                key={machine.id}
                to={`/machines/${machine.id}`}
                className="interactive-card flex items-center gap-4 rounded-xl border p-3 sm:p-4 text-sm"
              >
                <div className="font-display font-bold text-base text-gold w-6 text-center shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate text-sm sm:text-base">{machine.name}</span>
                    {machine.type && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        machine.type === "pachinko" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gold/10 text-gold border border-gold/20"
                      }`}>
                        {machine.type === "pachinko" ? "パチンコ" : "パチスロ"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {machine.maker ?? "メーカー不明"} ・ 動画数: <span className="font-semibold text-foreground">{machine.videoCount}本</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="flex items-center justify-end gap-1 text-info font-display font-semibold text-xs sm:text-sm">
                    <TrendingUp className="size-3.5" />
                    +{(machine.recentViews ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">直近7日勢い (PV)</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: 詳細ランキング・フィルターへの導線と詳細説明 */}
      <section className="border-t border-border/60 pt-8 mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border/80 surface-card p-5">
          <h3 className="font-semibold text-base mb-2">パチパルス！について</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            パチパルス！は、YouTube上に日々アップロードされるパチンコ・パチスロ系動画をクロールし、最新の再生数やチャンネル登録者推移、新台に関連する動画のバズ度を可視化するデータ分析プラットフォームです。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Link to="/about" className="text-gold hover:underline">パチパルス！について</Link>
            <span className="text-border">|</span>
            <Link to="/methodology" className="text-gold hover:underline">集計方法</Link>
          </div>
        </div>
        <div className="rounded-xl border border-border/80 surface-card p-5">
          <h3 className="font-semibold text-base mb-2">機能へのショートカット</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Link to="/channels" className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-gold/5 transition-all text-xs font-semibold text-foreground border border-border/40">
              全チャンネル一覧 <ArrowRight className="size-3.5 text-gold" />
            </Link>
            <Link to="/machines" className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-gold/5 transition-all text-xs font-semibold text-foreground border border-border/40">
              新台バズランキング <ArrowRight className="size-3.5 text-gold" />
            </Link>
            <Link to="/videos/trending" className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-gold/5 transition-all text-xs font-semibold text-foreground border border-border/40">
              今日伸びた動画 <ArrowRight className="size-3.5 text-gold" />
            </Link>
            <Link to="/weekly" className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-gold/5 transition-all text-xs font-semibold text-foreground border border-border/40">
              週刊データまとめ <ArrowRight className="size-3.5 text-gold" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Index;
