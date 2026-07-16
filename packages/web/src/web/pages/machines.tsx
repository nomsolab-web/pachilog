import { useQuery } from "@tanstack/react-query";
import { Eye, Flame, Video } from "lucide-react";
import { Link } from "wouter";
import { api } from "../lib/api";

function MachinesPage() {
  const machines = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await api.machines.$get()).json(),
  });

  return (
    <div>
      <section className="mb-8">
        <h1 className="font-display font-extrabold text-3xl mb-2">
          新台<span className="text-gold">バズ</span>ランキング
        </h1>
        <p className="text-muted-foreground">
          パチスロ・パチンコ系YouTuberの関連動画から、いま話題の新台を集計しています。
        </p>
      </section>

      {machines.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : machines.isError || !machines.data ? (
        <div className="text-center py-16 text-muted-foreground">新台データを取得できませんでした。</div>
      ) : machines.data.machines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          まだ新台が登録されていません。
        </div>
      ) : (
        <div className="space-y-3">
          {machines.data.machines.map((machine, index) => (
            <Link
              key={machine.id}
              to={`/machines/${machine.id}`}
              className="interactive-card flex items-center gap-4 rounded-xl border p-4"
            >
              <div className="font-display font-bold text-xl text-muted-foreground w-8 text-center">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate">{machine.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {machine.maker ?? "メーカー不明"}
                  {machine.releaseDate ? ` ・ ${machine.releaseDate} 導入` : ""}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5 text-gold">
                  <Flame className="size-4" />
                  <strong className="font-display">{machine.totalViews.toLocaleString()}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Video className="size-4" />
                  {machine.videoCount}本
                </span>
              </div>
              <div className="sm:hidden text-right">
                <p className="flex items-center justify-end gap-1 text-gold font-display font-semibold">
                  <Eye className="size-4" />
                  {machine.totalViews.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{machine.videoCount}本</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default MachinesPage;
