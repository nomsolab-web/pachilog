import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Snapshot = {
  date: string;
  subscriberCount: number;
  viewCount: number;
};

export function ChannelChart({ snapshots, metric }: { snapshots: Snapshot[]; metric: "subscriberCount" | "viewCount" }) {
  const data = snapshots.map((s) => ({
    date: s.date.slice(5), // MM-DD
    value: metric === "subscriberCount" ? s.subscriberCount : s.viewCount,
  }));

  if (data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
        データ収集中… まだグラフを描くのに十分な日数が溜まっていません
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => v.toLocaleString()}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent-blue)" strokeWidth={2} fill="url(#chartFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
