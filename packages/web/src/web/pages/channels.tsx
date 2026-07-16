import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { ChannelAvatar } from "../components/channel-avatar";
import { api } from "../lib/api";
import { formatJapaneseCount } from "../lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  media: "媒体",
  performer: "演者",
  individual: "個人",
  manufacturer: "メーカー",
  hall: "ホール",
  other: "その他",
};

function ChannelsPage() {
  const [query, setQuery] = useState("");
  const channels = useQuery({
    queryKey: ["channels"],
    queryFn: async () => (await api.channels.$get()).json(),
  });

  const list = useMemo(() => {
    const all = channels.data?.channels ?? [];
    return all
      .filter((channel) => channel.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => (b.latestSubscriberCount ?? 0) - (a.latestSubscriberCount ?? 0));
  }, [channels.data, query]);

  return (
    <div>
      <section className="site-hero rounded-2xl px-5 py-6 mb-8 sm:px-7">
        <h1 className="font-display font-extrabold text-3xl mb-3">全チャンネル</h1>
        <p className="text-muted-foreground max-w-3xl leading-7">
          監視対象のパチンコ・パチスロ系YouTubeチャンネル一覧です。登録者数は最新取得データを表示します。
        </p>
      </section>

      <label className="mb-4 flex items-center gap-2 rounded-xl border surface-card px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="チャンネル名で検索"
          aria-label="チャンネル名で検索"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {channels.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl surface-card">
          条件に合うチャンネルがありません。
        </div>
      ) : (
        <div className="grid gap-2">
          {list.map((channel) => (
            <Link key={channel.id} to={`/channels/${channel.id}`} className="interactive-card rounded-xl border px-4 py-3 flex items-center gap-3">
              <ChannelAvatar name={channel.name} thumbnailUrl={channel.thumbnailUrl} className="size-11 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{channel.name}</p>
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[channel.category] ?? "その他"}</p>
              </div>
              <p className="font-display font-bold text-sm text-info shrink-0">
                {formatJapaneseCount(channel.latestSubscriberCount, "人")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ChannelsPage;
