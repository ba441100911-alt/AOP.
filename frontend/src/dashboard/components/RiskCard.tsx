import { AlertCircle, Clock3, HeartPulse } from "lucide-react";
import type { DashboardSnapshot } from "../types";
import { StatusBadge } from "./StatusBadge";

type RiskCardProps = {
  snapshot: DashboardSnapshot;
};

export function RiskCard({ snapshot }: RiskCardProps) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-slate-950/30">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Current Risk Score</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-5xl font-semibold tracking-tight text-slate-100">{Math.round(snapshot.currentRisk * 100)}%</p>
        <StatusBadge status={snapshot.status} />
      </div>

      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-800/65 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm text-slate-300">
            <HeartPulse className="h-4 w-4 text-cyan-300" />
            Predicted Apnea Probability
          </span>
          <span className="text-sm font-semibold text-slate-100">{Math.round(snapshot.probability * 100)}%</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-800/65 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm text-slate-300">
            <Clock3 className="h-4 w-4 text-violet-300" />
            Time to Risk
          </span>
          <span className="text-sm font-semibold text-slate-100">Within {snapshot.timeToRiskSeconds} seconds</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-800/65 px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm text-slate-300">
            <AlertCircle className="h-4 w-4 text-amber-300" />
            Active Monitoring
          </span>
          <span className="text-sm font-semibold text-emerald-300">Stable Data Feed</span>
        </div>
      </div>
    </section>
  );
}
