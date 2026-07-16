import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Newspaper } from "lucide-react";
import { api } from "../lib/api";

function WeeklyPage() {
  const list = useQuery({
    queryKey: ["weekly"],
    queryFn: async () => (await api.weekly.$get()).json(),
  });

  return (
    <div>
      <section className="mb-10">
        <h1 className="font-display font-extrabold text-3xl mb-2">
          週刊<span className="text-gold">まとめ</span>
        </h1>
        <p className="text-muted-foreground">
          チャンネル推移・新台バズを週ごとに自動でまとめた記事です。攻略・期待値情報は含みません。
        </p>
      </section>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : !list.data || list.data.summaries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          まだ週刊まとめが生成されていません。
        </div>
      ) : (
        <div className="space-y-2">
          {list.data.summaries.map((s) => (
            <Link
              key={s.id}
              to={`/weekly/${s.weekOf}`}
              className="interactive-card flex items-center gap-3 rounded-xl border px-4 py-3"
            >
              <Newspaper className="size-4 text-gold shrink-0" />
              <div className="min-w-0">
                <p className="font-medium truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.weekOf} 週</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default WeeklyPage;
