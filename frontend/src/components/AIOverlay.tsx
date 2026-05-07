import type { Sample } from "../types";

const riskClasses = {
  Low: "bg-emerald-900/80 text-emerald-300",
  Moderate: "bg-amber-900/80 text-amber-300",
  High: "bg-red-900/80 text-red-300",
};

interface Props {
  sample: Sample;
}

export function AIOverlay({ sample }: Props) {
  return (
    <div className="absolute right-3 top-3 w-48 rounded-md border border-cyan-800 bg-slate-950/90 p-3 text-xs text-cyan-100 shadow-lg shadow-cyan-950/50">
      <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-400">AI Insight Layer</p>
      <p className="mt-2 text-sm font-semibold">{Math.round(sample.probability * 100)}% Apnea Probability</p>
      <p className={`mt-2 inline-block rounded px-2 py-1 font-semibold ${riskClasses[sample.risk]}`}>
        {sample.risk} Risk
      </p>
      <p className="mt-2 text-[10px] text-slate-400">Recommendation</p>
      <p className="font-semibold text-cyan-200">{sample.recommendation}</p>
    </div>
  );
}
