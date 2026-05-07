import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RiskPoint } from "../types";

type RiskChartProps = {
  data: RiskPoint[];
};

export function RiskChart({ data }: RiskChartProps) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/30">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">Risk Score Trend</h2>
        <span className="text-xs text-slate-500">Dynamic model score</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#fb7185" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
            <XAxis dataKey="time" tick={{ fill: "#7b90b4", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} />
            <YAxis
              tick={{ fill: "#7b90b4", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              domain={[0, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              formatter={(value) => {
                const numericValue = typeof value === "number" ? value : Number(value ?? 0);
                return `${Math.round(numericValue * 100)}%`;
              }}
              contentStyle={{
                backgroundColor: "rgba(12, 21, 40, 0.95)",
                border: "1px solid rgba(100, 116, 139, 0.4)",
                borderRadius: "12px",
                color: "#e2e8f0",
              }}
            />
            <Area type="monotone" dataKey="risk" stroke="#fb7185" fill="url(#riskGradient)" strokeWidth={2} isAnimationActive animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
