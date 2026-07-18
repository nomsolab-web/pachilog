import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Flame, Video, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { api } from "../lib/api";

function MachinesPage() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const machines = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await api.machines.$get()).json(),
  });

  const releaseMonths = useMemo(() => {
    if (!machines.data || !("machines" in machines.data)) return [];
    const months = machines.data.machines
      .map((m) => (m.releaseDate ? m.releaseDate.substring(0, 7) : null))
      .filter((m): m is string => !!m);
    return [...new Set(months)].sort().reverse();
  }, [machines.data]);

  const filteredMachines = useMemo(() => {
    if (!machines.data || !("machines" in machines.data)) return [];
    return machines.data.machines.filter((m) => {
      const typeMatches = selectedType === "all" || m.type === selectedType;
      const monthMatches =
        selectedMonth === "all" ||
        (m.releaseDate && m.releaseDate.startsWith(selectedMonth));
      return typeMatches && monthMatches;
    });
  }, [machines.data, selectedType, selectedMonth]);

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

      {/* Filter Section */}
      <section className="mb-6 flex flex-wrap gap-4 items-center justify-between p-4 border border-border surface-card rounded-xl">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              selectedType === "all"
                ? "bg-info/20 text-info border border-info/30"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            すべて
          </button>
          <button
            onClick={() => setSelectedType("pachinko")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              selectedType === "pachinko"
                ? "bg-info/20 text-info border border-info/30"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            パチンコ
          </button>
          <button
            onClick={() => setSelectedType("slot")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              selectedType === "slot"
                ? "bg-info/20 text-info border border-info/30"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            パチスロ
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">導入月:</span>
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
        <div className="space-y-3">
          {filteredMachines.map((machine, index) => (
            <Link
              key={machine.id}
              to={`/machines/${machine.id}`}
              className="interactive-card flex items-center gap-4 rounded-xl border p-4"
            >
              <div className="font-display font-bold text-xl text-muted-foreground w-8 text-center">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold truncate">{machine.name}</h2>
                  {machine.type && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      machine.type === "pachinko" ? "bg-primary/10 text-primary border border-primary/20" : "bg-gold/10 text-gold border border-gold/20"
                    }`}>
                      {machine.type === "pachinko" ? "パチンコ" : "パチスロ"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {machine.maker ?? "メーカー不明"}
                  {machine.releaseDate ? ` ・ ${machine.releaseDate} 導入` : ""}
                </p>
              </div>

              {/* Desktop momentum details */}
              <div className="hidden md:flex items-center gap-6 text-sm">
                <span className="flex flex-col items-end">
                  <span className="flex items-center gap-1.5 text-info">
                    <TrendingUp className="size-4" />
                    <strong className="font-display">+{(machine.recentViews ?? 0).toLocaleString()}</strong>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">直近7日勢い (PV)</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="flex items-center gap-1.5 text-gold">
                    <Flame className="size-4" />
                    <strong className="font-display">{machine.totalViews.toLocaleString()}</strong>
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">累計再生数 (PV)</span>
                </span>
                <span className="flex flex-col items-end">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Video className="size-4" />
                    {machine.videoCount}本
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">動画数</span>
                </span>
              </div>

              {/* Mobile momentum details */}
              <div className="md:hidden text-right flex flex-col justify-center items-end">
                <p className="flex items-center justify-end gap-1 text-info font-display font-semibold text-sm">
                  <TrendingUp className="size-3.5" />
                  +{(machine.recentViews ?? 0).toLocaleString()}
                </p>
                <p className="flex items-center justify-end gap-1 text-gold font-display font-semibold text-xs mt-1">
                  <Eye className="size-3" />
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
