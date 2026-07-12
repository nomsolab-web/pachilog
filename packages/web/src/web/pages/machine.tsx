import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, Flame, MessageCircle, ThumbsUp } from "lucide-react";
import { api } from "../lib/api";
import { MachineVoteWidget } from "../components/machine-vote-widget";

function MachinePage() {
  const { id } = useParams<{ id: string }>();

  const detail = useQuery({
    queryKey: ["machine", id],
    queryFn: async () => (await api.machines[":id"].$get({ param: { id } })).json(),
  });

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border border-border bg-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">新台情報が見つかりませんでした。</div>;
  }

  const { machine, mentions } = detail.data;
  const totalViews = mentions.reduce((sum, m) => sum + m.viewCount, 0);

  return (
    <div>
      <Link to="/machines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" />
        新台バズランキングに戻る
      </Link>

      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl mb-1">{machine.name}</h1>
        <p className="text-sm text-muted-foreground">
          {machine.maker} {machine.releaseDate ? `・${machine.releaseDate} 導入` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Flame className="size-3.5" />
            合計再生数(バズ指数)
          </p>
          <p className="font-display font-bold text-2xl">{totalViews.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
            <Eye className="size-3.5" />
            関連動画数
          </p>
          <p className="font-display font-bold text-2xl">{mentions.length}本</p>
        </div>
      </div>

      <div className="mb-6">
        <MachineVoteWidget machineId={machine.id} />
      </div>

      <section>
        <h2 className="font-display font-semibold text-lg mb-3">この新台を扱った動画</h2>
        {mentions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-xl text-sm">
            まだ関連動画が見つかっていません。収集が進むとここに表示されます。
          </div>
        ) : (
          <div className="space-y-2">
            {mentions.map((m) => (
              <a
                key={m.id}
                href={`https://www.youtube.com/watch?v=${m.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-border bg-card px-4 py-3 hover:bg-[var(--secondary)] transition-colors"
              >
                <p className="font-medium text-sm mb-1 truncate">{m.videoTitle}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{m.channelName}</span>
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5" />
                    {m.viewCount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="size-3.5" />
                    {m.likeCount.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="size-3.5" />
                    {m.commentCount.toLocaleString()}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default MachinePage;
