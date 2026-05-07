import { useEffect } from "react";
import { MonitorCard } from "../components/MonitorCard";
import { TopNav } from "../components/TopNav";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useMonitorStore } from "../state/useMonitorStore";

export function AdminGridPage() {
  const setRole = useMonitorStore((s) => s.setRole);
  const rooms = useMonitorStore((s) => s.rooms);
  const patients = useMonitorStore((s) => s.patients);

  useEffect(() => {
    setRole("admin");
  }, [setRole]);

  const getPatient = (id: string) => patients.find((p) => p.id === id);

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-grid admin-grid">
        {Object.entries(rooms).map(([roomId, patientIds]) => (
          <article key={roomId} className="room-cluster">
            <SectionHeader title={roomId} subtitle={`${patientIds.length} monitored beds`} />
            <div className="room-monitors">
              {patientIds.map((id) => {
                const patient = getPatient(id);
                return patient ? <MonitorCard key={id} patient={patient} compact /> : null;
              })}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
