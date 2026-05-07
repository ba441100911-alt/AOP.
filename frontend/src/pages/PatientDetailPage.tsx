import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { SectionHeader } from "../components/ui/SectionHeader";
import { Stat } from "../components/ui/Stat";
import { useMonitorStore } from "../state/useMonitorStore";

const metricCards = [
  { label: "Accuracy", value: "0.91" },
  { label: "Precision", value: "0.89" },
  { label: "Recall", value: "0.87" },
  { label: "F1-score", value: "0.88" },
];

export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const patients = useMonitorStore((s) => s.patients);
  const dailyEventCounts = useMonitorStore((s) => s.dailyEventCounts);
  const patient = patients.find((p) => p.id === patientId);

  if (!patient) {
    return (
      <main className="detail-shell">
        <p>Patient not found.</p>
        <Link className="mt-4 inline-block text-cyan-300" to="/nurse">
          Back to monitors
        </Link>
      </main>
    );
  }

  const chartData = patient.samples.slice(-120);
  const eventPoints = chartData.filter((s) => s.event !== "None");
  const current = chartData[chartData.length - 1];
  const aiRiskPercent = Math.round(current.probability * 100);
  const roomPatients = patients.filter((p) => p.roomId === patient.roomId);
  const baselineDrop = Number((patient.baselineSpO2 - current.spo2).toFixed(1));
  const rrBelow5 = chartData.filter((s) => s.rr < 5).length;
  const lowPauseRuns = chartData.reduce<number[]>(
    (runs, sample) => {
      if (sample.rr < 5) {
        const nextRuns = [...runs];
        nextRuns[nextRuns.length - 1] += 1;
        return nextRuns;
      }
      return [...runs, 0];
    },
    [0],
  );
  const qualifyingPauses = lowPauseRuns.filter((v) => v >= 5 && v <= 10).length;
  const bradyDetected = chartData.slice(-10).some((s) => s.hr < 100);
  const explainabilityChecks = [
    { label: "AOP rule (RR < 5 for >= 20s)", passed: rrBelow5 >= 20 },
    { label: "AOP SpO2 drop >= 5 baseline", passed: baselineDrop >= 5 },
    { label: "Bradycardia rule (HR < 100 for >= 1.2s)", passed: bradyDetected },
    { label: "PB pauses 5-10s, >= 3 in 120s", passed: qualifyingPauses >= 3 },
    { label: "SpO2 classification threshold", passed: ["Desaturation", "Normoxemia", "Hyperoxia"].includes(current.spo2Class) },
    { label: "Model threshold evaluation", passed: current.probability >= 0.3 },
  ];
  const lastHourEvents = eventPoints.length;
  const dailyEventCount = dailyEventCounts[patient.id] ?? eventPoints.length;
  const lastEvent = [...chartData].reverse().find((s) => s.event !== "None");
  const forecastData = chartData.map((point) => ({
    t: point.t,
    observed: point.probability,
    forecast: Math.min(
      1,
      point.probability +
        (point.event === "AOP" || point.event === "Bradycardia" ? 0.14 : point.event === "PB" ? 0.08 : 0.03),
    ),
  }));
  const isCritical = current.patientState === "Critical";

  return (
    <main className="detail-shell">
      <section className="detail-page">
        <div className="detail-header">
          <div>
            <p className="detail-eyebrow">NeoSense AI Clinical Insight Dashboard</p>
            <h1 className="detail-title">{patient.name}</h1>
            <p className="detail-subtitle">
              {patient.roomId} - {patient.bedLabel} - Gestational Age {patient.gestationalAgeWeeks} weeks
            </p>
          </div>
          <Button to="/nurse" variant="ghost">Back to Nurse Console</Button>
        </div>

        <section className="status-strip">
          <Stat label="Current AI Risk" value={`${aiRiskPercent}%`} foot={`${current.risk} risk level`} />
          <Stat label="Patient State" value={current.patientState} foot={`Prediction horizon ${current.predictionWindowSec}s`} />
          <Stat label="Recommendation" value={current.recommendation} foot="Clinical action priority" />
          <Stat label="Detected Event" value={current.event} foot={`Daily events ${dailyEventCount}`} />
          <Stat
            label="Live Analysis"
            value={lastEvent ? `Last ${lastEvent.event} at t-${current.t - lastEvent.t}s` : "No apnea event yet"}
            foot={`SpO2 ${current.spo2Class} | Pattern stream active`}
          />
        </section>

        {isCritical ? (
          <Panel className="critical-panel">
            <h3 className="chart-title critical-title">Critical Alert</h3>
            <p className="summary-text critical-text">
              High near-term apnea risk detected. This dashboard provides decision support only and does not replace clinician judgment.
            </p>
            <ul className="check-list">
              {current.interventions.map((step) => (
                <li key={step} className="check-item fail">
                  <span>ACT</span> {step}
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        <section className="chart-grid">
          <div className="chart-box">
            <h3 className="chart-title">Apnea Probability and Forecast (30-120s)</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={forecastData}>
                <CartesianGrid stroke="#355067" strokeDasharray="4 4" />
                <XAxis dataKey="t" tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="observed" stroke="#43c6ff" strokeWidth={2.4} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" stroke="#f6c66d" strokeWidth={1.8} dot={false} strokeDasharray="6 4" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {[
            { title: "HR Trend", key: "hr", color: "#4ab46d" },
            { title: "SpO2 Trend", key: "spo2", color: "#2e98bb" },
            { title: "RR Trend", key: "rr", color: "#b98d36" },
          ].map((chart) => (
            <div key={chart.title} className="chart-box">
              <h3 className="chart-title">{chart.title}</h3>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#355067" strokeDasharray="4 4" />
                  <XAxis dataKey="t" tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey={chart.key} stroke={chart.color} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </section>

        <Panel className="mt-3">
          <h3 className="chart-title">Event Timeline (AOP / Bradycardia / PB Markers)</h3>
          <div className="timeline-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#355067" strokeDasharray="4 4" />
                <XAxis dataKey="t" tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                <YAxis domain={[0, 1]} tick={{ fill: "#9cb8cd", fontSize: 11 }} />
                <Tooltip />
                <Line dataKey="probability" stroke="#58c7d8" dot={false} isAnimationActive={false} />
                {eventPoints.map((point) => (
                  <ReferenceDot
                    key={`${point.t}-${point.event}`}
                    x={point.t}
                    y={point.probability}
                    r={4}
                    fill={point.event === "AOP" || point.event === "Bradycardia" ? "#d24c4c" : "#caa85a"}
                    stroke="none"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="summary-text">
            Last 1h: {lastHourEvents} flagged events | Last 12h summary: {dailyEventCount} events for this patient | Room cohort:{" "}
            {roomPatients.length} monitored patients.
          </p>
        </Panel>

        <section className="split-grid">
          <Panel>
            <SectionHeader title="Explainability Panel" subtitle="Rule-level transparency for bedside decisions" />
            <ul className="check-list">
              {explainabilityChecks.map((check) => (
                <li key={check.label} className={`check-item ${check.passed ? "pass" : "fail"}`}>
                  <span>{check.passed ? "PASS" : "FAIL"}</span> {check.label}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <SectionHeader
              title="Model Performance"
              subtitle="Prototype output on PhysioNet PICS preterm infant cohort"
            />
            <div className="metric-grid">
              {metricCards.map((metric) => (
                <div key={metric.label} className="metric-tile">
                  <p className="metric-label">{metric.label}</p>
                  <p className="metric-value">{metric.value}</p>
                </div>
              ))}
            </div>
            {current.spo2Simulated ? (
              <p className="summary-text">
                Note: SpO2 channel is simulated for UI continuity. PICS does not include pulse oximetry.
              </p>
            ) : null}
          </Panel>
        </section>
      </section>
    </main>
  );
}
