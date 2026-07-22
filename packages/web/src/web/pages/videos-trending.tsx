import { useEffect, useTransition } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { VideoCard } from "../components/video-card";
import {
  VIDEO_CONTENT_TYPE_TABS,
  normalizeContentTypeSearchParams,
  parseVideoContentType,
  updateContentTypeSearchParams,
  videoTrendMetricLabel,
  videoTrendingQueryParams,
  type VideoContentTypeValue,
} from "../lib/video-content-types";

type Mode = "previous" | "7d";

function VideosTrendingPage() {
  const [location, setLocation] = useLocation();
  const [, startTransition] = useTransition();
  const { mode, contentType } = useVideoTrendingUrlState(location);
  const [path] = location.split("?");

  const videos = useInfiniteQuery({
    queryKey: ["videos-trending", mode, contentType],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      (
        await api.videos.trending.$get({
          query: videoTrendingQueryParams(mode, contentType, pageParam),
        })
      ).json(),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const pages = videos.data?.pages ?? [];
  const videoList = pages.flatMap((page) => page.videos);
  const counts = pages[0]?.counts;

  const updateParams = (next: { contentType?: VideoContentTypeValue; mode?: Mode }) => {
    startTransition(() => {
      const params = updateContentTypeSearchParams(
        queryStringFromLocation(location),
        next.contentType ?? contentType,
        { resetCursor: true },
      );
      params.set("mode", next.mode ?? mode);
      params.delete("type");
      setLocation(`${path || "/videos/trending"}?${params.toString()}`);
    });
  };

  useEffect(() => {
    const normalized = normalizeContentTypeSearchParams(queryStringFromLocation(location));
    if (normalized.shouldReplace) {
      setLocation(`${path || "/videos/trending"}?${normalized.params.toString()}`, { replace: true });
    }
  }, [location, path, setLocation]);

  return (
    <div>
      <section className="site-hero rounded-2xl px-5 py-5 mb-8 sm:px-7">
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl mb-2">伸びている動画</h1>
        <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
          収集済みの動画から、比較期間内に再生数が伸びた動画を種別ごとに表示します。「前回収集から」は24時間固定ではなく、前回データ取得時点との比較です。
        </p>
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="segmented-control flex gap-1 rounded-lg border p-1 bg-background/50">
          <button
            onClick={() => updateParams({ mode: "previous" })}
            className={`segmented-button px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
              mode === "previous" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            前回収集から
          </button>
          <button
            onClick={() => updateParams({ mode: "7d" })}
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

      <ContentTypeTabs
        active={contentType}
        counts={counts}
        onChange={(nextContentType) => updateParams({ contentType: nextContentType })}
      />

      {videos.isLoading ? (
        <LoadingGrid />
      ) : videos.isError ? (
        <ErrorState onRetry={() => videos.refetch()} />
      ) : videoList.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {videoList.map((video, index) => (
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
                  contentType={video.contentType}
                  metric={videoTrendMetricLabel(video)}
                />
              </div>
            ))}
          </div>

          {videos.hasNextPage && (
            <div className="mt-8 text-center">
              <button
                onClick={() => videos.fetchNextPage()}
                disabled={videos.isFetchingNextPage}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-2.5 text-sm font-semibold text-foreground hover:border-gold/60 hover:text-gold transition-colors disabled:opacity-50 min-w-40 justify-center"
              >
                {videos.isFetchingNextPage ? (
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
        順位は比較期間内の再生数増加で決まります。データが7日分そろっていない動画は暫定日数を併記します。
      </div>
    </div>
  );
}

export function useVideoTrendingUrlState(location: string) {
  const params = new URLSearchParams(queryStringFromLocation(location));
  const requestedMode = params.get("mode");
  return {
    mode: requestedMode === "7d" ? "7d" : "previous",
    contentType: parseVideoContentType(params.get("contentType") ?? params.get("type")),
  };
}

export function ContentTypeTabs({
  active,
  counts,
  onChange,
}: {
  active: VideoContentTypeValue;
  counts?: Partial<Record<VideoContentTypeValue, number>>;
  onChange: (value: VideoContentTypeValue) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="動画種別"
      className="mb-6 flex gap-2 border-b border-border pb-px overflow-x-auto whitespace-nowrap no-scrollbar scroll-smooth"
    >
      {VIDEO_CONTENT_TYPE_TABS.map((tab) => {
        const isActive = active === tab.value;
        const count = counts?.[tab.value] ?? 0;
        const isZero = count === 0;

        return (
          <button
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            aria-controls={`trending-${tab.value}-panel`}
            onClick={() => onChange(tab.value)}
            className={`pb-3.5 pt-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:border-gold rounded-t-md ${
              isActive
                ? "border-gold text-gold opacity-100"
                : "border-transparent text-muted-foreground hover:text-foreground"
            } ${isZero && !isActive ? "opacity-45 hover:opacity-80" : ""}`}
          >
            {tab.label}
            {counts?.[tab.value] !== undefined && (
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-display font-bold transition-colors ${
                isActive
                  ? "bg-gold/15 text-gold"
                  : "bg-secondary text-muted-foreground"
              } ${isZero ? "opacity-60" : ""}`}>
                {counts[tab.value]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-[345px] rounded-xl border surface-card animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-muted-foreground max-w-xl mx-auto my-8">
      <AlertTriangle className="size-8 text-rose-500 mx-auto mb-3" />
      <h3 className="text-foreground font-semibold mb-1">動画データを取得できませんでした</h3>
      <p className="text-xs mb-4">通信状態を確認して、もう一度お試しください。</p>
      <button
        onClick={onRetry}
        className="rounded-lg border border-rose-500/40 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
      >
        再試行する
      </button>
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border surface-card px-5 py-16 text-center text-muted-foreground max-w-xl mx-auto my-8 text-sm">
      <p className="font-semibold text-foreground mb-1">この種別の動画はまだありません</p>
      <p className="text-xs">別の動画種別または比較期間をお試しください。</p>
    </div>
  );
}

function queryStringFromLocation(location: string) {
  const queryStart = location.indexOf("?");
  if (queryStart >= 0) return location.slice(queryStart);
  return typeof window === "undefined" ? "" : window.location.search;
}

export default VideosTrendingPage;
