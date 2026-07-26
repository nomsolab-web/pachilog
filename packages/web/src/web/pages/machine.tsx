import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Factory, Film, SearchX, TrendingUp, Video, Eye } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import { api } from "../lib/api";
import { MachineVoteWidget } from "../components/machine-vote-widget";
import { VideoCard } from "../components/video-card";
import {
  VIDEO_CONTENT_TYPE_TABS,
  machineDetailQueryParams,
  parseVideoContentType,
  type VideoContentTypeValue,
} from "../lib/video-content-types";

type SortMode = "rising" | "newest" | "views";

function MachinePage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const [visibleCount, setVisibleCount] = useState(20);
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const contentType = parseVideoContentType(params.get("contentType"));
  const sort = parseSort(params.get("sort"));

  const detail = useQuery({
    queryKey: ["machine", id, contentType, sort],
    queryFn: async () => (await api.machines[":id"].$get(({
      param: { id },
      query: machineDetailQueryParams(contentType, sort),
    } as never))).json(),
  });

  useEffect(() => setVisibleCount(20), [contentType, sort]);

  const updateParams = (next: { contentType?: VideoContentTypeValue; sort?: SortMode }) => {
    const nextParams = new URLSearchParams(location.split("?")[1] ?? "");
    nextParams.set("contentType", next.contentType ?? contentType);
    nextParams.set("sort", next.sort ?? sort);
    setLocation(`/machines/${id}?${nextParams.toString()}`);
  };

  if (detail.isLoading) return <div className="animate-pulse h-64 rounded-xl border surface-card" />;
  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="py-16 text-center text-muted-foreground">Machine information could not be loaded.</div>;
  }

  const { machine, summary } = detail.data;
  const mentions = detail.data.mentions;
  const contentTypeCounts: Partial<Record<VideoContentTypeValue, number>> = "contentTypeCounts" in detail.data ? detail.data.contentTypeCounts : {};
  const visibleMentions = mentions.slice(0, visibleCount);
  const isRisingEmpty = sort === "rising" && mentions.length === 0 && summary.rankingVideoCount > 0;

  return (
    <div>
      <Link to="/machines" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All machines
      </Link>

      <section className="site-hero mb-6 rounded-2xl px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="mb-3 break-words font-display text-3xl font-extrabold">{machine.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Factory className="size-4" />{machine.maker ?? "Maker unknown"}</span>
              <span className="inline-flex items-center gap-1.5"><Film className="size-4" />{machine.type === "pachinko" ? "Pachinko" : machine.type === "slot" ? "Pachislot" : "Type unknown"}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" />{formatDate(machine.releaseDate)}</span>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto">
            <Stat icon={<Video className="size-3.5" />} label="Related videos" value={summary.videoCount} hint="all types" />
            <Stat icon={<CalendarDays className="size-3.5" />} label="Last 7 days" value={summary.recentVideoCount} hint="published" />
            <Stat icon={<TrendingUp className="size-3.5" />} label="Views gained" value={summary.recentViews} hint="last 7 days" />
            <Stat icon={<Eye className="size-3.5" />} label="Ranking pool" value={summary.rankingVideoCount} hint="standard/short/live" />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Last updated: {formatDateTime(summary.lastUpdatedAt)}</p>
      </section>

      <div className="mb-6"><MachineVoteWidget machineId={machine.id} /></div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Videos for this machine</h2>
            <p className="mt-1 text-xs text-muted-foreground">Related videos includes every confirmed content type. Ranking pool excludes promotion and unknown.</p>
          </div>
          <div className="segmented-control flex gap-1 rounded-lg border p-1">
            {(["rising", "newest", "views"] as const).map((mode) => (
              <button key={mode} onClick={() => updateParams({ sort: mode })} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${sort === mode ? "segmented-button-active bg-info/20 text-info" : "text-muted-foreground hover:text-foreground"}`}>
                {mode === "rising" ? "Trending" : mode === "newest" ? "Newest" : "Views"}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto whitespace-nowrap border-b border-border pb-px no-scrollbar">
          {VIDEO_CONTENT_TYPE_TABS.map((tab) => {
            const count = contentTypeCounts?.[tab.value] ?? 0;
            return <button key={tab.value} onClick={() => updateParams({ contentType: tab.value })} className={`shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold ${contentType === tab.value ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{tab.label}<span className="ml-1.5 text-xs">{count}</span></button>;
          })}
        </div>

        {mentions.length === 0 ? (
          <MachineEmptyState contentType={contentType} rising={isRisingEmpty} />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {visibleMentions.map((video) => <VideoCard key={video.videoId} videoId={video.videoId} title={video.videoTitle} thumbnailUrl={null} publishedAt={video.publishedAt} viewCount={video.viewCount} channelName={video.channelName} channelThumbnailUrl={video.channelThumbnailUrl} contentType={video.contentType} machineTags={video.machineTags} metric={sort === "rising" ? formatTrend(video) : undefined} />)}
            </div>
            {visibleCount < mentions.length && <div className="mt-6 text-center"><button onClick={() => setVisibleCount((count) => count + 20)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-info/60 hover:text-info">Load more</button></div>}
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: number; hint: string }) {
  return <div className="rounded-xl border surface-card p-3"><p className="flex items-center gap-1 text-[11px] text-muted-foreground">{icon}{label}</p><p className="mt-1 font-display text-xl font-bold">{value.toLocaleString("ja-JP")}</p><p className="text-[10px] text-muted-foreground">{hint}</p></div>;
}

function MachineEmptyState({ contentType, rising }: { contentType: VideoContentTypeValue; rising: boolean }) {
  const message = rising ? "Trending needs at least two dated view snapshots." : contentType === "standard" ? "No confirmed standard videos are linked to this machine." : `No confirmed ${contentType} videos are linked to this machine.`;
  return <div className="rounded-xl border border-dashed border-border surface-card px-5 py-12 text-center text-muted-foreground"><SearchX className="mx-auto mb-3 size-8 text-info" /><p className="font-semibold text-foreground">No videos to show</p><p className="mt-2 text-sm">{message}</p></div>;
}

function parseSort(value: string | null): SortMode { return value === "newest" || value === "views" ? value : "rising"; }
function formatTrend(video: { hasTrend: boolean; viewDelta: number }) { return video.hasTrend ? `+${video.viewDelta.toLocaleString("ja-JP")} views / 7d` : "History unavailable"; }
function formatDate(value: string | null | undefined) { if (!value) return "Release date unknown"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(date); }
function formatDateTime(value: string | Date | null | undefined) { if (!value) return "No update timestamp"; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date); }

export default MachinePage;
