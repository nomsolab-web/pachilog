import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, ExternalLink, Factory, Film, SearchX } from "lucide-react";
import { api } from "../lib/api";
import { MachineVoteWidget } from "../components/machine-vote-widget";
import { VideoCard } from "../components/video-card";

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

  // Group sorted mentions by release date
  const groups = useMemo(() => {
    const preRelease: VideoMention[] = [];
    const postRelease7: VideoMention[] = [];
    const postReleaseAfter: VideoMention[] = [];
    const unclassified: VideoMention[] = [];

    if (!detail.data || "error" in detail.data) {
      return { preRelease, postRelease7, postReleaseAfter, unclassified };
    }

    const releaseDate = detail.data.machine.releaseDate;
    if (!releaseDate) {
      return {
        preRelease,
        postRelease7,
        postReleaseAfter,
        unclassified: mentions,
      };
    }

    const relTime = new Date(releaseDate).getTime();
    if (isNaN(relTime)) {
      return {
        preRelease,
        postRelease7,
        postReleaseAfter,
        unclassified: mentions,
      };
    }

    // 7 days in milliseconds: 7 * 24 * 60 * 60 * 1000
    const relTimePlus7 = relTime + 7 * 24 * 60 * 60 * 1000;

    for (const video of mentions) {
      if (!video.publishedAt) {
        unclassified.push(video);
        continue;
      }
      const pubTime = new Date(video.publishedAt).getTime();
      if (isNaN(pubTime)) {
        unclassified.push(video);
        continue;
      }

      if (pubTime < relTime) {
        preRelease.push(video);
      } else if (pubTime <= relTimePlus7) {
        postRelease7.push(video);
      } else {
        postReleaseAfter.push(video);
      }
    }

    return { preRelease, postRelease7, postReleaseAfter, unclassified };
  }, [mentions, detail.data]);

  const tabs = [
    { id: "postRelease7", label: "導入後7日以内", count: groups.postRelease7.length, data: groups.postRelease7 },
    { id: "postReleaseAfter", label: "導入8日目以降", count: groups.postReleaseAfter.length, data: groups.postReleaseAfter },
    { id: "preRelease", label: "導入前", count: groups.preRelease.length, data: groups.preRelease },
    { id: "unclassified", label: "分類不能", count: groups.unclassified.length, data: groups.unclassified },
  ];

  // Pick first tab that has items, default to the first tab (postRelease7)
  const defaultTab = tabs.find(t => t.count > 0)?.id || "postRelease7";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Sync activeTab if defaultTab changes (e.g. data loads)
  const [prevDefaultTab, setPrevDefaultTab] = useState(defaultTab);
  if (defaultTab !== prevDefaultTab) {
    setPrevDefaultTab(defaultTab);
    setActiveTab(defaultTab);
  }

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border surface-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">機種情報が見つかりませんでした。</div>;
  }

  const { machine, summary } = detail.data;
  const activeGroupVideos = tabs.find(t => t.id === activeTab)?.data || [];
  const visibleMentions = activeGroupVideos.slice(0, visibleCount);

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
                {machine.type === "pachinko" ? "パチンコ" : machine.type === "slot" ? "パチスロ" : "種別未設定"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                {machine.releaseDate ? `${formatDate(machine.releaseDate)} 導入` : "導入日未設定"}
              </span>
              {machine.officialUrl && (
                <a
                  href={machine.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-info hover:text-info/80 font-semibold"
                >
                  <ExternalLink className="size-4" />
                  公式サイト
                </a>
              )}
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

        {/* Category Tabs */}
        {mentions.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setVisibleCount(20);
                }}
                className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-info text-info"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {mentions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground">
            <SearchX className="mx-auto mb-3 size-8 text-info" />
            <p className="font-semibold text-foreground">まだ関連動画が見つかっていません。</p>
            <p className="mt-2 text-sm">日次収集で該当動画が見つかると、ここに一覧表示されます。</p>
          </div>
        ) : activeGroupVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground">
            <SearchX className="mx-auto mb-3 size-8 text-info" />
            <p className="font-semibold text-foreground">この分類には動画がありません。</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleMentions.map((mention) => (
                <VideoCard
                  key={mention.videoId}
                  videoId={mention.videoId}
                  title={mention.videoTitle}
                  thumbnailUrl={null}
                  publishedAt={mention.publishedAt}
                  viewCount={mention.viewCount}
                  channelName={mention.channelName}
                  channelThumbnailUrl={mention.channelThumbnailUrl}
                />
              ))}
            </div>
            {visibleCount < activeGroupVideos.length && (
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
