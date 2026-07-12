import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api";

function WeeklyDetailPage() {
  const { weekOf } = useParams<{ weekOf: string }>();

  const detail = useQuery({
    queryKey: ["weekly", weekOf],
    queryFn: async () => (await api.weekly[":weekOf"].$get({ param: { weekOf } })).json(),
  });

  if (detail.isLoading) {
    return <div className="animate-pulse h-64 rounded-xl border border-border bg-card" />;
  }

  if (detail.isError || !detail.data || "error" in detail.data) {
    return <div className="text-center py-16 text-muted-foreground">まとめ記事が見つかりませんでした。</div>;
  }

  return (
    <div>
      <Link to="/weekly" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="size-4" />
        週刊まとめ一覧に戻る
      </Link>

      <article className="prose prose-invert max-w-none rounded-xl border border-border bg-card p-6 [&_h1]:font-display [&_h2]:font-display [&_h1]:text-2xl [&_h2]:text-lg [&_h1]:font-bold [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_li]:text-sm [&_p]:text-sm [&_p]:text-muted-foreground">
        <ReactMarkdown>{detail.data.summary.bodyMarkdown}</ReactMarkdown>
      </article>
    </div>
  );
}

export default WeeklyDetailPage;
