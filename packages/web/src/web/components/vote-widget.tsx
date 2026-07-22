import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThumbsDown, ThumbsUp, HelpCircle } from "lucide-react";
import { api } from "../lib/api";
import { getVoterFingerprint } from "../lib/fingerprint";

export function VoteWidget({ channelId }: { channelId: number }) {
  const queryClient = useQueryClient();
  const [localVote, setLocalVote] = useState<"good" | "bad" | "unknown" | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Load local vote on mount
  useEffect(() => {
    const saved = localStorage.getItem(`voted_channel_${channelId}`);
    if (saved === "good" || saved === "bad" || saved === "unknown") {
      setLocalVote(saved);
    }
  }, [channelId]);

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
      return voteType;
    },
    onSuccess: (voteType) => {
      localStorage.setItem(`voted_channel_${channelId}`, voteType);
      setLocalVote(voteType);
      setStatusMessage({ text: "投票しました！", isError: false });
      queryClient.invalidateQueries({ queryKey: ["votes", channelId] });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    },
    onError: () => {
      setStatusMessage({ text: "通信エラーが発生しました。もう一度お試しください。", isError: true });
    },
  });

  const total = votes.data?.total ?? 0;
  const counts = votes.data?.counts ?? { good: 0, bad: 0, unknown: 0 };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="rounded-xl border surface-card p-4">
      <p className="text-sm font-medium mb-3">このチャンネル、どう思う？</p>
      <div className="flex gap-2">
        <button
          onClick={() => vote.mutate("good")}
          disabled={vote.isPending}
          aria-pressed={localVote === "good"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "good"
              ? "border-rise text-rise bg-rise/10 shadow-sm"
              : "border-border hover:border-rise hover:text-rise"
          }`}
        >
          <ThumbsUp className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.good)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("bad")}
          disabled={vote.isPending}
          aria-pressed={localVote === "bad"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "bad"
              ? "border-fall text-fall bg-fall/10 shadow-sm"
              : "border-border hover:border-fall hover:text-fall"
          }`}
        >
          <ThumbsDown className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.bad)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("unknown")}
          disabled={vote.isPending}
          aria-pressed={localVote === "unknown"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "unknown"
              ? "border-muted-foreground text-muted-foreground bg-muted/10 shadow-sm"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <HelpCircle className="size-4" />
          <span className="text-xs font-display font-semibold">{pct(counts.unknown)}%</span>
        </button>
      </div>

      {statusMessage && (
        <p
          role="alert"
          className={`text-xs mt-2.5 text-center font-semibold transition-all ${
            statusMessage.isError ? "text-rose-500" : "text-gold"
          }`}
        >
          {statusMessage.text}
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-2 text-center">
        {total}票 {localVote && <span className="text-gold font-semibold ml-1">(投票済み)</span>}
      </p>
    </div>
  );
}
