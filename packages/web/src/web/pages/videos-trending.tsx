import { useEffect, useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { VideoCard, getVideoType } from "../components/video-card";

type Mode = "previous" | "7d";
type ContentType = "standard" | "short" | "live" | "promotion";

function VideosTrendingPage() {
  const [, setLocation] = useLocation();
  const [, startTransition] = useTransition();

  // Read URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const mode = (searchParams.get("mode") as Mode) || "previous";
  const contentType = (searchParams.get("type") as ContentType) || "standard";

  const [visibleCount, setVisibleCount] = useState(20);
  const [isAppending, setIsAppending] = useState(false);
  const [srAnnouncement, setSrAnnouncement] = useState("");

  const videos = useQuery({
    queryKey: ["videos-trending", mode],
    queryFn: async () => (await api.videos.trending.$get({ query: { mode } })).json(),
  });

  const rawList = videos.data?.videos ?? [];

  // Parse types and calculate counts for each tab
  const classifiedVideos = rawList.map(v => ({
    ...v,
    computedType: getVideoType(v.title, v.channelName),
  }));

  const counts = {
    standard: classifiedVideos.filter(v => v.computedType === "standard").length,
    short: classifiedVideos.filter(v => v.computedType === "short").length,
    live: classifiedVideos.filter(v => v.computedType === "live").length,
    promotion: classifiedVideos.filter(v => v.computedType === "promotion").length,
  };

  const filteredList = classifiedVideos.filter(v => v.computedType === contentType);
  const paginatedList = filteredList.slice(0, visibleCount);

  // Sync state changes back to URL query parameters
  const updateParams = (newType: ContentType, newMode: Mode) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set("type", newType);
      params.set("mode", newMode);
      setLocation(`${window.location.pathname}?${params.toString()}`);
      setVisibleCount(20); // Reset pagination on filter change
    });
  };

  // Announce page state to screen readers
  useEffect(() => {
    if (videos.isLoading) {
      setSrAnnouncement("データを読み込み中です。");
    } else if (videos.isError) {
      setSrAnnouncement("エラーが発生しました。");
    } else {
      setSrAnnouncement(
        `動画の読み込みが完了しました。${filteredList.length}件中${paginatedList.length}件を表示しています。`
      );
    }
  }, [videos.isLoading, videos.isError, filteredList.length, paginatedList.length]);

  const handleLoadMore = () => {
    setIsAppending(true);
    // Simulate minor network delay for smooth UX and layout shift prevention
    setTimeout(() => {
      setVisibleCount(prev => Math.min(prev + 20, filteredList.length));
      setIsAppending(false);
    }, 400);
  };

  return (
    <div>
      <output aria-live="polite" className="sr-only">
        {srAnnouncement}
      </output>

      <section className="site-hero rounded-2xl px-5 py-5 mb-8 sm:px-7">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl mb-2">伸びている動画</h1>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          直近収集した動画履歴から、再生数の増加が大きい動画を表示します。「前回収集から」は24時間ではなく、前回データ取得時点との比較です。
        </p>
      </section>

      {/* Mode Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="segmented-control flex gap-1 rounded-lg border p-1 bg-background/50">
          <button
            onClick={() => updateParams(contentType, "previous")}
            className={`segmented-button px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              mode === "previous" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            前回収集から
          </button>
          <button
            onClick={() => updateParams(contentType, "7d")}
            className={`segmented-button px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              mode === "7d" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7日間
          </button>
        </div>
        <Link to="/" className="text-xs sm:text-sm text-gold hover:text-gold/80 transition-colors">
          トップへ戻る
        </Link>
      </div>

      {/* Content Type Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-px overflow-x-auto whitespace-nowrap">
        {(["standard", "short", "live", "promotion"] as ContentType[]).map((type) => {
          const isActive = contentType === type;
          const labels = {
            standard: "通常動画",
            short: "ショート",
            live: "ライブ",
            promotion: "公式PV・CM",
          };
          return (
            <button
              key={type}
              onClick={() => updateParams(type, mode)}
              className={`pb-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 ${
                isActive
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {labels[type]}
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-display font-bold">
                {counts[type]}
              </span>
            </button>
          );
        })}
      </div>

      {videos.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-72 rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : videos.isError ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-muted-foreground max-w-xl mx-auto my-8">
          <AlertTriangle className="size-8 text-rose-500 mx-auto mb-3" />
          <h3 className="text-foreground font-semibold mb-1">動画データを取得できませんでした</h3>
          <p className="text-xs mb-4">ネットワーク接続をご確認いただくか、もう一度お試しください。</p>
          <button
            onClick={() => videos.refetch()}
            className="rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            再試行する
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border surface-card px-5 py-16 text-center text-muted-foreground max-w-xl mx-auto my-8 text-sm">
          <p className="font-semibold text-foreground mb-1">対象の動画がありませんでした</p>
          <p className="text-xs mb-4">別の動画種別タブまたは比較期間をお試しください。</p>
          <button
            onClick={() => updateParams("standard", mode)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-info/60 hover:text-info transition-colors"
          >
            通常動画に戻る
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {paginatedList.map((video, index) => (
              <div key={video.videoId} className="relative">
                <div className="absolute left-3 top-3 z-20 flex size-8 items-center justify-center rounded-lg border border-gold/40 bg-background/95 font-display font-extrabold text-gold text-xs shadow-md">
                  {index + 1}
                </div>
                <VideoCard
                  videoId={video.videoId}
                  title={video.title}
                  thumbnailUrl={video.thumbnailUrl}
                  publishedAt={video.publishedAt}
                  viewCount={video.currentViewCount}
                  channelName={video.channelName}
                  channelThumbnailUrl={video.channelThumbnailUrl}
                  metric={
                    video.hasTrend
                      ? `+${video.viewDelta.toLocaleString("ja-JP")}回 / ${video.viewDeltaPct.toFixed(1)}%${
                          video.isProvisional ? ` (${video.snapshotDays}日)` : ""
                        }`
                      : "データ蓄積中"
                  }
                />
              </div>
            ))}
          </div>

          {visibleCount < filteredList.length && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isAppending}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-foreground hover:border-gold/60 hover:text-gold transition-colors disabled:opacity-50 min-w-40 justify-center"
              >
                {isAppending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    読み込み中...
                  </>
                ) : (
                  "もっと見る"
                )}
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="size-4" />
        増加率は参考表示で、順位は再生増加数で決まります。
      </div>
    </div>
  );
}

export default VideosTrendingPage;
