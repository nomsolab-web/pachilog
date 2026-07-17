import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { VideoCard } from "../components/video-card";

type Mode = "previous" | "7d";

function VideosTrendingPage() {
  const [mode, setMode] = useState<Mode>("previous");
  const videos = useQuery({
    queryKey: ["videos-trending", mode],
    queryFn: async () => (await api.videos.trending.$get({ query: { mode } })).json(),
  });

  const list = videos.data?.videos ?? [];

  return (
    <div>
      <section className="site-hero rounded-2xl px-5 py-6 mb-8 sm:px-7">
        <h1 className="font-display font-extrabold text-3xl mb-3">伸びている動画</h1>
        <p className="text-muted-foreground max-w-3xl leading-7">
          直近収集した動画履歴から、再生数の増加が大きい動画を表示します。「前回収集から」は24時間ではなく、前回データ取得時点との比較です。
        </p>
      </section>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="segmented-control flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setMode("previous")}
            className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
              mode === "previous" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            前回収集から
          </button>
          <button
            onClick={() => setMode("7d")}
            className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
              mode === "7d" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            7日間
          </button>
        </div>
        <Link to="/" className="text-sm text-gold hover:text-gold/80">
          トップへ戻る
        </Link>
      </div>

      {videos.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground">
          動画履歴を蓄積中です。
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((video, index) => (
            <div key={video.videoId} className="relative">
              <div className="absolute left-3 top-3 z-10 flex size-9 items-center justify-center rounded-lg border border-info/40 bg-background/90 font-display font-bold text-info">
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
                        video.isProvisional ? ` (${video.snapshotDays}日集計)` : ""
                      }`
                    : "データ蓄積中"
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="size-4" />
        増加率は参考表示で、順位は再生増加数で決まります。
      </div>
    </div>
  );
}

export default VideosTrendingPage;
