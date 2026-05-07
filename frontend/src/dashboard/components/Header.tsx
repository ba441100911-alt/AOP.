import { Wifi } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import logo from "../../assets/neosense-logo.png";

export function Header() {
  return (
    <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 px-6 py-5 shadow-2xl shadow-slate-950/40 backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div>
        <img src={logo} alt="NeoSense AI" className="h-14 w-auto object-contain" />
        <p className="mt-1 text-sm text-slate-400">Predictive Neonatal Monitoring System</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100">
          <Wifi className="h-3.5 w-3.5" />
          Connected
        </div>
        <StatusBadge status="Live" />
      </div>
    </header>
  );
}
