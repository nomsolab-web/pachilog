import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Eye, MinusCircle } from "lucide-react";
import { api } from "../lib/api";
import { getVoterFingerprint } from "../lib/fingerprint";

type VoteType = "want_to_play" | "wait_and_see" | "not_interested";

export function MachineVoteWidget({ machineId }: { machineId: number }) {
  const queryClient = useQueryClient();
  const [localVote, setLocalVote] = useState<VoteType | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Load local vote on mount
  useEffect(() => {
    const saved = localStorage.getItem(`voted_machine_${machineId}`);
    if (saved === "want_to_play" || saved === "wait_and_see" || saved === "not_interested") {
      setLocalVote(saved as VoteType);
    }
  }, [machineId]);

  const votes = useQuery({
    queryKey: ["machine-votes", machineId],
    queryFn: async () => (await api.machines[":id"].votes.$get({ param: { id: String(machineId) } })).json(),
  });

  const vote = useMutation({
    mutationFn: async (voteType: VoteType) => {
      await api.machines[":id"].votes.$post({
        param: { id: String(machineId) },
        json: { voteType, voterFingerprint: getVoterFingerprint() },
      });
      return voteType;
    },
    onSuccess: (voteType) => {
      localStorage.setItem(`voted_machine_${machineId}`, voteType);
      setLocalVote(voteType);
      setStatusMessage({ text: "投票しました！", isError: false });
      queryClient.invalidateQueries({ queryKey: ["machine-votes", machineId] });

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
  const counts = votes.data?.counts ?? { want_to_play: 0, wait_and_see: 0, not_interested: 0 };
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="rounded-xl border surface-card p-4">
      <p className="text-sm font-medium mb-3">この新台、気になる？</p>
      <div className="flex gap-2">
        <button
          onClick={() => vote.mutate("want_to_play")}
          disabled={vote.isPending}
          aria-pressed={localVote === "want_to_play"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "want_to_play"
              ? "border-gold text-gold bg-gold/10 shadow-sm"
              : "border-border hover:border-gold hover:text-gold"
          }`}
        >
          <Flame className="size-4" />
          <span className="text-[11px]">打ってみたい</span>
          <span className="text-xs font-display font-semibold">{pct(counts.want_to_play)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("wait_and_see")}
          disabled={vote.isPending}
          aria-pressed={localVote === "wait_and_see"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "wait_and_see"
              ? "border-info text-info bg-info/10 shadow-sm"
              : "border-border hover:border-info hover:text-info"
          }`}
        >
          <Eye className="size-4" />
          <span className="text-[11px]">様子見</span>
          <span className="text-xs font-display font-semibold">{pct(counts.wait_and_see)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("not_interested")}
          disabled={vote.isPending}
          aria-pressed={localVote === "not_interested"}
          className={`flex-1 flex flex-col items-center gap-1 rounded-lg border py-2 transition-all disabled:opacity-50 ${
            localVote === "not_interested"
              ? "border-muted-foreground text-muted-foreground bg-muted/10 shadow-sm"
              : "border-border hover:border-muted-foreground"
          }`}
        >
          <MinusCircle className="size-4" />
          <span className="text-[11px]">興味なし</span>
          <span className="text-xs font-display font-semibold">{pct(counts.not_interested)}%</span>
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
