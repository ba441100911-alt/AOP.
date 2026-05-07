import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { RiskStatus } from "../types";

type StatusBadgeProps = {
  status: RiskStatus | "Live";
};

const statusMap = {
  Low: {
    className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
    icon: ShieldCheck,
  },
  Medium: {
    className: "border-amber-400/35 bg-amber-500/15 text-amber-100",
    icon: AlertTriangle,
  },
  High: {
    className: "border-red-400/35 bg-red-500/15 text-red-100",
    icon: ShieldAlert,
  },
  Live: {
    className: "border-cyan-400/35 bg-cyan-500/15 text-cyan-100",
    icon: ShieldCheck,
  },
} as const;

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
