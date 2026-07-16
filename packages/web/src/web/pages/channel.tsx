import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Users } from "lucide-react";
import { api } from "../lib/api";
import { formatJapaneseCount } from "../lib/format";
import { ChannelChart } from "../components/channel-chart";
import { VoteWidget } from "../components/vote-widget";
import { ShareButton } from "../components/share-button";

function ChannelPage() {
  const { id } = useParams<{ id: string }>();
  const [metric, setMetric] = useState<"subscriberCount" | "viewCount">("subscriberCount");

  const detail = useQuery({
    queryKey: ["channel", id],
    queryFn: async () => (await api.channels[":id"].$get({ param: { id } })).json(),
  });

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border surface-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">チャンネルが見つかりませんでした。</div>;
  }

  const { channel, snapshots } = detail.data;
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
        {channel.thumbnailUrl ? (
          <img src={channel.thumbnailUrl} alt={channel.name} className="size-16 rounded-full object-cover" />
        ) : (
          <div className="size-16 rounded-full bg-secondary" />
        )}
        <div>
          <h1 className="font-display font-bold text-2xl">{channel.name}</h1>
          {channel.handle && <p className="text-sm text-muted-foreground">{channel.handle}</p>}
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
    </div>
  );
}

export default ChannelPage;
