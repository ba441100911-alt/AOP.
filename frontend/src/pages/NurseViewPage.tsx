import { MonitorCard } from "../components/MonitorCard";
import { TopNav } from "../components/TopNav";
import { Panel } from "../components/ui/Panel";
import { SectionHeader } from "../components/ui/SectionHeader";
import { useMonitorStore } from "../state/useMonitorStore";

export function NurseViewPage() {
  const patients = useMonitorStore((s) => s.patients);
  const assignment = useMonitorStore((s) => s.nurseAssignment);

  const primary = patients.find((p) => p.id === assignment.primaryPatientId);
  const secondary = assignment.secondaryPatientId ? patients.find((p) => p.id === assignment.secondaryPatientId) : undefined;

  return (
    <main className="page-shell">
      <TopNav />
      <section className="content-grid nurse-grid">
        <Panel>
          <SectionHeader title="Primary Patient" subtitle="Priority tracking and immediate intervention support" />
          {primary ? <MonitorCard patient={primary} /> : <p className="empty-state">No primary patient assigned.</p>}
        </Panel>
        <Panel>
          <SectionHeader title="Secondary Patient" subtitle="Cross-coverage and continuous observation" />
          {secondary ? <MonitorCard patient={secondary} compact /> : <p className="empty-state">No secondary patient assigned.</p>}
        </Panel>
      </section>
    </main>
  );
}
