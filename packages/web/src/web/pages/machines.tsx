import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Flame, HelpCircle, TrendingUp, Video } from "lucide-react";
import { Link } from "wouter";
import { api } from "../lib/api";
import { machineTypeLabel, normalizeMachineType, type MachineType } from "../../shared/machine-type";

export type MachineFilterType = MachineType | "all";

export const INITIAL_MACHINE_LIMIT = 20;

export type MachineRankingStats = {
  id: number;
  videoCount?: number | null;
  recentViews?: number | null;
  channelCount?: number | null;
};

export function normalizeMachineList<T extends { type?: unknown }>(machines: readonly T[]) {
  return machines.map((machine) => ({ ...machine, type: normalizeMachineType(machine.type) }));
}

export function filterMachineList<T extends { type?: unknown; releaseDate?: string | null }>(
  machines: readonly T[],
  selectedType: MachineFilterType,
  selectedMonth: string,
) {
  return machines.filter((machine) => {
    const typeMatches = selectedType === "all" || normalizeMachineType(machine.type) === selectedType;
    const monthMatches = selectedMonth === "all" || !!machine.releaseDate?.startsWith(selectedMonth);
    return typeMatches && monthMatches;
  });
}

export function countMachineTypes<T extends { type?: unknown }>(machines: readonly T[]) {
  return machines.reduce(
    (counts, machine) => {
      const type = normalizeMachineType(machine.type);
      if (type) counts[type] += 1;
      else counts.unknown += 1;
      return counts;
    },
    { pachinko: 0, slot: 0, unknown: 0 },
  );
}

export function splitMachinesByRankingEligibility<T extends MachineRankingStats>(machines: readonly T[]) {
  return {
    ranked: machines.filter((machine) => (machine.videoCount ?? 0) > 0),
    unranked: machines.filter((machine) => (machine.videoCount ?? 0) <= 0),
  };
}

export function visibleRankedMachines<T>(machines: readonly T[], visibleCount: number) {
  return machines.slice(0, visibleCount);
}

export function expandedMachineLimit(current: number, total: number) {
  return Math.min(total, current + INITIAL_MACHINE_LIMIT);
}

export function resetMachineVisibleCount() {
  return INITIAL_MACHINE_LIMIT;
}

export function isReferenceMachine(machine: MachineRankingStats) {
  const count = machine.videoCount ?? 0;
  return count >= 1 && count <= 2;
}

export function averageRecentViewsPerVideo(machine: MachineRankingStats) {
  const count = machine.videoCount ?? 0;
  if (count <= 0) return 0;
  return Math.round((machine.recentViews ?? 0) / count);
}

function MachinesPage() {
  const [selectedType, setSelectedType] = useState<MachineFilterType>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_MACHINE_LIMIT);

  const machines = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await api.machines.$get()).json(),
  });

  useEffect(() => {
    setVisibleCount(resetMachineVisibleCount());
  }, [selectedType, selectedMonth]);

  const releaseMonths = useMemo(() => {
    if (!machines.data || !("machines" in machines.data)) return [];
    const months = normalizeMachineList(machines.data.machines)
      .map((m) => (m.releaseDate ? m.releaseDate.substring(0, 7) : null))
      .filter((m): m is string => !!m);
    return [...new Set(months)].sort().reverse();
  }, [machines.data]);

  const filteredMachines = useMemo(() => {
    if (!machines.data || !("machines" in machines.data)) return [];
    return filterMachineList(normalizeMachineList(machines.data.machines), selectedType, selectedMonth);
  }, [machines.data, selectedType, selectedMonth]);

  const { ranked, unranked } = useMemo(
    () => splitMachinesByRankingEligibility(filteredMachines),
    [filteredMachines],
  );
  const visibleRanked = visibleRankedMachines(ranked, visibleCount);
  const hasMore = visibleCount < ranked.length;

  const machineCounts = useMemo(
    () => machines.data && "machines" in machines.data ? countMachineTypes(machines.data.machines) : { pachinko: 0, slot: 0, unknown: 0 },
    [machines.data],
  );

  return (
    <div>
      <section className="mb-8">
        <h1 className="font-display font-extrabold text-3xl mb-2">
          新台<span className="text-gold">バズ</span>ランキング
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          PachiPulseが収集したYouTube動画をもとに集計しています。YouTube全体を完全に網羅したランキングではありません。
        </p>
      </section>

      <section className="mb-6 flex flex-wrap gap-4 items-center justify-between p-4 border border-border surface-card rounded-xl">
        <div className="flex gap-2">
          <FilterButton active={selectedType === "all"} onClick={() => setSelectedType("all")}>すべて</FilterButton>
          <FilterButton active={selectedType === "pachinko"} onClick={() => setSelectedType("pachinko")}>パチンコ</FilterButton>
          <FilterButton active={selectedType === "slot"} onClick={() => setSelectedType("slot")}>パチスロ</FilterButton>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>パチンコ {machineCounts.pachinko}</span>
          <span>パチスロ {machineCounts.slot}</span>
          {machineCounts.unknown > 0 && <span>未設定 {machineCounts.unknown}</span>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">導入月</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-background border border-border rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-info"
          >
            <option value="all">すべて</option>
            {releaseMonths.map((month) => {
              const [year, m] = month.split("-");
              return (
                <option key={month} value={month}>
                  {year}年{m}月
                </option>
              );
            })}
          </select>
        </div>
      </section>

      {machines.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 rounded-xl border surface-card animate-pulse" />
          ))}
        </div>
      ) : machines.isError || !machines.data ? (
        <div className="text-center py-16 text-muted-foreground">新台データを取得できませんでした。</div>
      ) : filteredMachines.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-xl">
          条件に合う機種が見つかりませんでした。
        </div>
      ) : (
        <div className="space-y-5">
          {ranked.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
              集計対象動画がある機種はまだありません。
            </div>
          ) : (
            <div className="space-y-3">
              {visibleRanked.map((machine, index) => (
                <MachineRankingRow key={machine.id} machine={machine} rank={index + 1} />
              ))}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((current) => expandedMachineLimit(current, ranked.length))}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-info hover:text-info transition-colors"
                  >
                    もっと見る
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {unranked.length > 0 && (
            <details className="rounded-xl border border-border surface-card">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-sm font-semibold">
                <span>動画未検出の新台を見る（{unranked.length}件）</span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </summary>
              <div className="border-t border-border divide-y divide-border/70">
                {unranked.map((machine) => (
                  <MachineUnrankedRow key={machine.id} machine={machine} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "bg-info/20 text-info border border-info/30"
          : "text-muted-foreground hover:text-foreground border border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

type MachineListItem = ReturnType<typeof normalizeMachineList<{
  id: number;
  name: string;
  type?: unknown;
  maker?: string | null;
  releaseDate?: string | null;
  totalViews: number;
  videoCount: number;
  recentViews: number;
  channelCount?: number | null;
}>>[number];

function MachineRankingRow({ machine, rank }: { machine: MachineListItem; rank: number }) {
  const average = averageRecentViewsPerVideo(machine);
  return (
    <Link
      to={`/machines/${machine.id}`}
      className="interactive-card grid grid-cols-[44px_minmax(0,1fr)] md:grid-cols-[56px_minmax(0,1fr)_auto] gap-3 md:gap-5 rounded-xl border p-4"
    >
      <div className="flex items-start justify-center">
        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-info/10 text-info font-display font-bold border border-info/20">
          {rank}
        </span>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-semibold truncate">{machine.name}</h2>
          {machineTypeLabel(machine.type) && <MachineTypeBadge type={machine.type} />}
          {isReferenceMachine(machine) && (
            <span
              title="集計動画が1〜2本のため、少数データによる参考値です。"
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold bg-gold/10 text-gold border border-gold/20"
            >
              参考値
              <HelpCircle className="size-3" />
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {machine.maker ?? "メーカー不明"}
          {machine.releaseDate ? ` ・ ${machine.releaseDate} 導入` : ""}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          動画{machine.videoCount.toLocaleString()}本投稿{(machine.channelCount ?? 0).toLocaleString()}ch｜1本平均 {formatSigned(average)}
        </p>
      </div>

      <div className="col-span-2 md:col-span-1 grid grid-cols-2 md:flex md:items-center gap-3 md:gap-6 text-sm">
        <Metric icon={<TrendingUp className="size-4" />} value={formatSigned(machine.recentViews ?? 0)} label="7日間の再生増加" tone="text-info" />
        <Metric icon={<Flame className="size-4" />} value={(machine.totalViews ?? 0).toLocaleString()} label="累計再生数" tone="text-gold" />
      </div>
    </Link>
  );
}

function MachineUnrankedRow({ machine }: { machine: MachineListItem }) {
  return (
    <Link to={`/machines/${machine.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium truncate">{machine.name}</h3>
          {machineTypeLabel(machine.type) && <MachineTypeBadge type={machine.type} />}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {machine.maker ?? "メーカー不明"}
          {machine.releaseDate ? ` ・ ${machine.releaseDate} 導入` : ""}
        </p>
      </div>
      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Video className="size-3.5" />
        動画未検出
      </span>
    </Link>
  );
}

function MachineTypeBadge({ type }: { type: MachineType | null }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
      type === "pachinko" ? "bg-primary/10 text-primary border border-primary/20" : type === "slot" ? "bg-gold/10 text-gold border border-gold/20" : "bg-secondary text-muted-foreground border border-border"
    }`}>
      {machineTypeLabel(type)}
    </span>
  );
}

function Metric({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: string }) {
  return (
    <span className="flex flex-col md:items-end">
      <span className={`flex items-center gap-1.5 ${tone}`}>
        {icon}
        <strong className="font-display">{value}</strong>
      </span>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </span>
  );
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

export default MachinesPage;
