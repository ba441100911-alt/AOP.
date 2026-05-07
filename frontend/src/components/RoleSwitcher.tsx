import { useMonitorStore } from "../state/useMonitorStore";
import type { Role } from "../types";

export function RoleSwitcher() {
  const role = useMonitorStore((s) => s.role);
  const setRole = useMonitorStore((s) => s.setRole);

  const buttonClass = (option: Role) =>
    `rounded-md border px-3 py-1 text-sm font-medium transition ${
      role === option
        ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
        : "border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400"
    }`;

  return (
    <div className="flex items-center gap-2">
      <button type="button" className={buttonClass("admin")} onClick={() => setRole("admin")}>
        Admin View
      </button>
      <button type="button" className={buttonClass("nurse")} onClick={() => setRole("nurse")}>
        Nurse View
      </button>
    </div>
  );
}
