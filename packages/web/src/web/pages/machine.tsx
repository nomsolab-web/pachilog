import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Eye, ExternalLink, Factory, Film, SearchX } from "lucide-react";
import { api } from "../lib/api";
import { ChannelAvatar } from "../components/channel-avatar";
import { MachineVoteWidget } from "../components/machine-vote-widget";

type SortMode = "newest" | "views";
type VideoMention = {
  videoId: string;
  videoTitle: string;
  viewCount: number;
  publishedAt: string | null;
  channelName: string;
  channelThumbnailUrl: string | null;
};

function MachinePage() {
  const { id } = useParams<{ id: string }>();
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [visibleCount, setVisibleCount] = useState(20);

  const detail = useQuery({
    queryKey: ["machine", id],
    queryFn: async () => (await api.machines[":id"].$get({ param: { id } })).json(),
  });

  const mentions = useMemo(() => {
    if (!detail.data || "error" in detail.data) return [];
    const sorted = [...detail.data.mentions];
    sorted.sort((a, b) => {
      if (sortMode === "views") return b.viewCount - a.viewCount || compareDateDesc(a.publishedAt, b.publishedAt);
      return compareDateDesc(a.publishedAt, b.publishedAt) || b.viewCount - a.viewCount;
    });
    return sorted;
  }, [detail.data, sortMode]);

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border surface-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">機種情報が見つかりませんでした。</div>;
  }

  const { machine, summary } = detail.data;
  const visibleMentions = mentions.slice(0, visibleCount);

  return (
    <div>
      <Link to="/machines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" />
        新台バズランキングに戻る
      </Link>

      <section className="site-hero rounded-2xl px-5 py-6 mb-6 sm:px-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display font-extrabold text-3xl mb-3">{machine.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Factory className="size-4" />
                {machine.maker ?? "メーカー未設定"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Film className="size-4" />
                {machine.type ?? "種別未設定"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {machine.releaseDate ? `${formatDate(machine.releaseDate)} 導入` : "導入日未設定"}
              </span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              集計期間: {summary.periodStart && summary.periodEnd ? `${formatDate(summary.periodStart)} - ${formatDate(summary.periodEnd)}` : "データ蓄積中"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-60">
            <div className="rounded-xl border surface-card p-4">
              <p className="text-xs text-muted-foreground mb-1">関連動画</p>
              <p className="font-display font-bold text-2xl">{summary.videoCount.toLocaleString("ja-JP")}</p>
            </div>
            <div className="rounded-xl border surface-card p-4">
              <p className="text-xs text-muted-foreground mb-1">合計再生数</p>
              <p className="font-display font-bold text-2xl">{summary.totalViews.toLocaleString("ja-JP")}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6">
        <MachineVoteWidget machineId={machine.id} />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-semibold text-lg">関連動画一覧</h2>
          <div className="segmented-control flex gap-1 rounded-lg border p-1">
            <button
              onClick={() => setSortMode("newest")}
              className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
                sortMode === "newest" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              新着順
            </button>
            <button
              onClick={() => setSortMode("views")}
              className={`segmented-button px-3 py-1.5 rounded-md text-sm font-semibold ${
                sortMode === "views" ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              再生数順
            </button>
          </div>
        </div>

        {mentions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground">
            <SearchX className="mx-auto mb-3 size-8 text-info" />
            <p className="font-semibold text-foreground">まだ関連動画が見つかっていません。</p>
            <p className="mt-2 text-sm">日次収集で該当動画が見つかると、ここに一覧表示されます。</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleMentions.map((mention) => (
                <VideoCard key={mention.videoId} mention={mention as VideoMention} />
              ))}
            </div>
            {visibleCount < mentions.length && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setVisibleCount((count) => count + 20)}
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

function VideoCard({ mention }: { mention: VideoMention }) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${mention.videoId}`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${mention.videoId}/hqdefault.jpg`;

  return (
    <article className="interactive-card overflow-hidden rounded-xl border">
      <a
        href={youtubeUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${mention.videoTitle} をYouTubeで見る`}
        className="block"
      >
        <img src={thumbnailUrl} alt="" loading="lazy" className="aspect-video w-full object-cover bg-secondary" />
      </a>
      <div className="p-4">
        <h3 className="line-clamp-2 min-h-11 font-semibold leading-snug">{mention.videoTitle}</h3>
        <div className="mt-3 flex items-center gap-2">
          <ChannelAvatar name={mention.channelName} thumbnailUrl={mention.channelThumbnailUrl} className="size-8 rounded-full" />
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{mention.channelName}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>{formatDate(mention.publishedAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3.5" />
            {mention.viewCount.toLocaleString("ja-JP")}回
          </span>
        </div>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-semibold text-gold hover:bg-gold/10"
        >
          YouTubeで見る
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </article>
  );
}

function compareDateDesc(a: string | null, b: string | null) {
  return Date.parse(b ?? "") - Date.parse(a ?? "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export default MachinePage;
