type MetricsCardProps = {
  label: string;
  value: number;
  subtitle: string;
};

export function MetricsCard({ label, value, subtitle }: MetricsCardProps) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-4 shadow-xl shadow-slate-950/30">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{(value * 100).toFixed(0)}%</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </article>
  );
}
