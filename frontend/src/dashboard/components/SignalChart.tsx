import { Activity } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SignalPoint } from "../types";

type SignalChartProps = {
  data: SignalPoint[];
};

export function SignalChart({ data }: SignalChartProps) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/30">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
          <Activity className="h-4 w-4 text-emerald-300" />
          Live ECG Signal
        </h2>
        <span className="text-xs text-slate-500">Real-time waveform</span>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" tick={{ fill: "#7b90b4", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={22} />
            <YAxis tick={{ fill: "#7b90b4", fontSize: 11 }} axisLine={false} tickLine={false} domain={[35, 120]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(12, 21, 40, 0.95)",
                border: "1px solid rgba(100, 116, 139, 0.4)",
                borderRadius: "12px",
                color: "#e2e8f0",
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6ee7b7"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
