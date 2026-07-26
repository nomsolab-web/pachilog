import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { prepareChartData } from "../lib/chart-data";

type Snapshot = {
  date: string;
  subscriberCount: number;
  viewCount: number;
};

export function ChannelChart({ snapshots, metric }: { snapshots: Snapshot[]; metric: "subscriberCount" | "viewCount" }) {
  const {
    data,
    yDomain,
    ticks,
    latestSubscriberCount,
    isPublic,
    delta,
    deltaPct,
    periodDays,
  } = prepareChartData(snapshots, metric);

  if (data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-info border border-dashed border-info/40 rounded-xl bg-info/10">
        データ収集中… まだグラフを描くのに十分な日数が溜まっていません
      </div>
    );
  }

  const isSubscribers = metric === "subscriberCount";
  const deltaSign = delta > 0 ? "+" : "";
  const pctSign = deltaPct > 0 ? "+" : "";

  // Consistent tick formatting logic
  const maxAbsTick = Math.max(...ticks.map(Math.abs));
  const useManUnit = maxAbsTick >= 10000;

  const formatYAxisTick = (val: number) => {
    if (val === 0) return "0";
    const sign = val < 0 ? "-" : (isSubscribers ? "+" : "");
    const absVal = Math.abs(val);

    if (useManUnit) {
      const manVal = absVal / 10000;
      if (Number.isInteger(manVal)) {
        return `${sign}${manVal}万`;
      } else {
        return `${sign}${manVal.toFixed(1)}万`;
      }
    } else {
      return `${sign}${absVal.toLocaleString("ja-JP")}`;
    }
  };

  return (
    <div className="space-y-4">
      {isSubscribers && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm bg-secondary/35 rounded-xl p-4 border border-border/40 shadow-inner">
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-xs font-medium">現在:</span>
            <span className="font-display font-extrabold text-lg text-foreground tracking-tight">
              {isPublic ? `${latestSubscriberCount.toLocaleString("ja-JP")}人` : "非公開"}
            </span>
          </div>
          {isPublic && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{periodDays}日間で</span>
              <span className={`font-bold text-sm ${delta > 0 ? "text-rise" : delta < 0 ? "text-fall" : "text-foreground"}`}>
                {deltaSign}{delta.toLocaleString("ja-JP")}人
              </span>
              <span className={`text-[11px] font-semibold ${deltaPct > 0 ? "text-rise" : deltaPct < 0 ? "text-fall" : "text-foreground"}`}>
                （{pctSign}{deltaPct.toFixed(2)}%）
              </span>
            </div>
          )}
        </div>
      )}

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={56}
              domain={yDomain}
              ticks={ticks}
              tickFormatter={formatYAxisTick}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload;
                  const { rawVal, value: growth, dayDiff } = dataPoint;
                  const unit = isSubscribers ? "人" : "回";
                  const rawFormatted = `${rawVal.toLocaleString("ja-JP")}${unit}`;
                  const growthSign = growth > 0 ? "+" : "";
                  const growthFormatted = `${growthSign}${growth.toLocaleString("ja-JP")}${unit}`;
                  const dayDiffSign = dayDiff > 0 ? "+" : "";
                  const dayDiffFormatted = `${dayDiffSign}${dayDiff.toLocaleString("ja-JP")}${unit}`;

                  return (
                    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3 text-xs shadow-xl space-y-1.5 min-w-44 text-left">
                      <p className="font-semibold text-muted-foreground">{label}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">日別の{isSubscribers ? "登録者数" : "再生数"}:</span>
                          <span className="font-semibold text-foreground">{rawFormatted}</span>
                        </div>
                        {isSubscribers && (
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">開始からの増減:</span>
                            <span className={`font-semibold ${growth > 0 ? "text-rise" : growth < 0 ? "text-fall" : "text-foreground"}`}>
                              {growthFormatted}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">前日比:</span>
                          <span className={`font-semibold ${dayDiff > 0 ? "text-rise" : dayDiff < 0 ? "text-fall" : "text-foreground"}`}>
                            {dayDiffFormatted}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area type="stepAfter" dataKey="value" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#chartFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
