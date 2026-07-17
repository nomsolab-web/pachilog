import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Users, Youtube } from "lucide-react";
import { api } from "../lib/api";
import { formatJapaneseCount } from "../lib/format";
import { getYouTubeChannelUrl } from "../lib/youtube";
import { ChannelChart } from "../components/channel-chart";
import { ChannelAvatar } from "../components/channel-avatar";
import { VideoCard } from "../components/video-card";
import { VoteWidget } from "../components/vote-widget";
import { ShareButton } from "../components/share-button";

function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const [metric, setMetric] = useState<"subscriberCount" | "viewCount">("subscriberCount");
  const [videoSort, setVideoSort] = useState<"newest" | "views">("newest");
  const [visibleVideos, setVisibleVideos] = useState(20);

  const detail = useQuery({
    queryKey: ["channel", id],
    queryFn: async () => (await api.channels[":id"].$get({ param: { id } })).json(),
  });

  const recentVideos = useMemo(() => {
    const list = [...(detail.data && !("error" in detail.data) ? detail.data.videos : [])];
    list.sort((a, b) => {
      if (videoSort === "views") return b.viewCount - a.viewCount || compareDateDesc(a.publishedAt, b.publishedAt);
      return compareDateDesc(a.publishedAt, b.publishedAt) || b.viewCount - a.viewCount;
    });
    return list;
  }, [detail.data, videoSort]);

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border surface-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">チャンネルが見つかりませんでした。</div>;
  }

  const { channel, snapshots } = detail.data;
  const youtubeUrl = getYouTubeChannelUrl(channel);
  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots.length > 1 ? snapshots[0] : null;
  const deltaPct =
    latest && prev && prev.subscriberCount > 0
      ? ((latest.subscriberCount - prev.subscriberCount) / prev.subscriberCount) * 100
      : 0;

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" />
        ランキングに戻る
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <ChannelAvatar name={channel.name} thumbnailUrl={channel.thumbnailUrl} className="size-16 rounded-full" />
        <div>
          <h1 className="font-display font-bold text-2xl">{channel.name}</h1>
          {channel.handle && <p className="text-sm text-muted-foreground">{channel.handle}</p>}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/10"
            >
              <Youtube className="size-4" />
              YouTubeで開く
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border surface-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Users className="size-3.5" />
            登録者数
          </p>
          <p className="font-display font-bold text-2xl">{formatJapaneseCount(latest?.subscriberCount, "人")}</p>
        </div>
        <div className="rounded-xl border surface-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Eye className="size-3.5" />
            総再生数
          </p>
          <p className="font-display font-bold text-2xl">{latest ? latest.viewCount.toLocaleString("ja-JP") : "-"}</p>
        </div>
      </div>

      <div className="rounded-xl border surface-card p-4 mb-6">
        <div className="segmented-control inline-flex gap-1 rounded-lg border p-1 mb-4">
          <button
            onClick={() => setMetric("subscriberCount")}
            className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
              metric === "subscriberCount" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            登録者数
          </button>
          <button
            onClick={() => setMetric("viewCount")}
            className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
              metric === "viewCount" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            再生数
          </button>
        </div>
        <ChannelChart snapshots={snapshots} metric={metric} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <VoteWidget channelId={channel.id} />
        <div className="rounded-xl border surface-card p-4">
          <p className="text-sm font-medium mb-3">この結果をシェア</p>
          <ShareButton name={channel.name} subscriberCount={latest?.subscriberCount ?? 0} deltaPct={deltaPct} />
        </div>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-lg">最近の動画</h2>
          <div className="segmented-control flex gap-1 rounded-lg border p-1">
            <button
              onClick={() => setVideoSort("newest")}
              className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
                videoSort === "newest" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              新着順
            </button>
            <button
              onClick={() => setVideoSort("views")}
              className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
                videoSort === "views" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              再生数順
            </button>
          </div>
        </div>

        {recentVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground">
            <p className="font-semibold text-foreground">まだ動画データがありません。</p>
            <p className="mt-2 text-sm">日次収集で直近動画が取得されると、ここに表示されます。</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {recentVideos.slice(0, visibleVideos).map((video) => (
                <VideoCard
                  key={video.videoId}
                  videoId={video.videoId}
                  title={video.title}
                  thumbnailUrl={video.thumbnailUrl}
                  publishedAt={video.publishedAt}
                  viewCount={video.viewCount}
                />
              ))}
            </div>
            {visibleVideos < recentVideos.length && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setVisibleVideos((count) => count + 20)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-info/60 hover:text-info"
                >
                  もっと見る
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function compareDateDesc(a: string | null, b: string | null) {
  return Date.parse(b ?? "") - Date.parse(a ?? "");
}

export default ChannelPage;
