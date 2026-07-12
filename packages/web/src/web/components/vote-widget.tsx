import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp, HelpCircle } from "lucide-react";
import { api } from "../lib/api";
import { getVoterFingerprint } from "../lib/fingerprint";

export function VoteWidget({ channelId }: { channelId: number }) {
  const queryClient = useQueryClient();

  const votes = useQuery({
    queryKey: ["votes", channelId],
    queryFn: async () => (await api.channels[":id"].votes.$get({ param: { id: String(channelId) } })).json(),
  });

  const vote = useMutation({
    mutationFn: async (voteType: "good" | "bad" | "unknown") => {
      await api.channels[":id"].votes.$post({
        param: { id: String(channelId) },
        json: { voteType, voterFingerprint: getVoterFingerprint() },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["votes", channelId] }),
  });

  const total = votes.data?.total ?? 0;
  const counts = votes.data?.counts ?? { good: 0, bad: 0, unknown: 0 };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium mb-3">このチャンネル、どう思う？</p>
      <div className="flex gap-2">
        <button
          onClick={() => vote.mutate("good")}
          disabled={vote.isPending}
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-rise hover:text-rise transition-colors disabled:opacity-50"
        >
          <ThumbsUp className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.good)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("bad")}
          disabled={vote.isPending}
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-fall hover:text-fall transition-colors disabled:opacity-50"
        >
          <ThumbsDown className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.bad)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("unknown")}
          disabled={vote.isPending}
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-muted-foreground transition-colors disabled:opacity-50"
        >
          <HelpCircle className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.unknown)}%</span>
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">{total}票</p>
    </div>
  );
}
