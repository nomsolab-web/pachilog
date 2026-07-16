import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Eye, MinusCircle } from "lucide-react";
import { api } from "../lib/api";
import { getVoterFingerprint } from "../lib/fingerprint";

export function MachineVoteWidget({ machineId }: { machineId: number }) {
  const queryClient = useQueryClient();

  const votes = useQuery({
    queryKey: ["machine-votes", machineId],
    queryFn: async () => (await api.machines[":id"].votes.$get({ param: { id: String(machineId) } })).json(),
  });

  const vote = useMutation({
    mutationFn: async (voteType: "want_to_play" | "wait_and_see" | "not_interested") => {
      await api.machines[":id"].votes.$post({
        param: { id: String(machineId) },
        json: { voteType, voterFingerprint: getVoterFingerprint() },
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["machine-votes", machineId] }),
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
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-gold hover:text-gold transition-colors disabled:opacity-50"
        >
          <Flame className="size-4" />
          <span className="text-[11px]">打ってみたい</span>
          <span className="text-xs font-display font-semibold">{pct(counts.want_to_play)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("wait_and_see")}
          disabled={vote.isPending}
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-info hover:text-info transition-colors disabled:opacity-50"
        >
          <Eye className="size-4" />
          <span className="text-[11px]">様子見</span>
          <span className="text-xs font-display font-semibold">{pct(counts.wait_and_see)}%</span>
        </button>
        <button
          onClick={() => vote.mutate("not_interested")}
          disabled={vote.isPending}
          className="flex-1 flex flex-col items-center gap-1 rounded-lg border border-border py-2 hover:border-muted-foreground transition-colors disabled:opacity-50"
        >
          <MinusCircle className="size-4" />
          <span className="text-[11px]">興味なし</span>
          <span className="text-xs font-display font-semibold">{pct(counts.not_interested)}%</span>
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">{total}票</p>
    </div>
  );
}
