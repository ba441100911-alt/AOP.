import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useNavigate } from "react-router-dom";
import { TopNav } from "../components/TopNav";
import { useMonitorStore } from "../state/useMonitorStore";

export function HomePage() {
  const navigate = useNavigate();
  const patient = useMonitorStore((s) => s.patients[0]);

  if (!patient) {
    return null;
  }

  const current = patient.samples[patient.samples.length - 1];
  const ecgRows = [
    patient.samples.slice(-80).map((s) => ({ t: s.t, ecg: s.ecg })),
    patient.samples.slice(-80).map((s) => ({ t: s.t, ecg: s.ecg * 0.65 })),
    patient.samples.slice(-80).map((s) => ({ t: s.t, ecg: s.ecg * 0.48 })),
  ];
  const systolic = Math.round(current.hr * 0.95);
  const diastolic = Math.round(current.hr * 0.58);
  const temp = (36.3 + (current.hr - 110) * 0.008).toFixed(1);
  const aiRisk = Math.round(current.probability * 100);
  const riskLabel = current.patientState;

  return (
    <main className="screen-root">
      <TopNav />
      <section className="bedside-monitor">
        <div className="wave-column">
          <div className="monitor-caption">
            <span>{patient.roomId}</span>
            <span>{patient.name}</span>
          </div>
          {ecgRows.map((row, index) => (
            <div key={index} className="wave-panel">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={row}>
                  <YAxis hide domain={[-40, 40]} />
                  <Line type="monotone" dataKey="ecg" stroke="#66d88a" strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>

        <aside className="vitals-column">
          <div className="vital-module">
            <p className="vital-label">HR</p>
            <p className="vital-value vital-green">{current.hr}</p>
            <p className="vital-unit">bpm</p>
          </div>
          <div className="vital-module">
            <p className="vital-label">NIBP</p>
            <p className="vital-value vital-cyan">
              {systolic}/{diastolic}
            </p>
            <p className="vital-unit">mmHg</p>
          </div>
          <div className="vital-module">
            <p className="vital-label">SpO2</p>
            <p className="vital-value vital-cyan">{current.spo2}</p>
            <p className="vital-unit">%</p>
          </div>
          <div className="vital-module">
            <p className="vital-label">TEMP</p>
            <p className="vital-value vital-yellow">{temp}</p>
            <p className="vital-unit">degC</p>
          </div>
          <div className="vital-module">
            <p className="vital-label">RR</p>
            <p className="vital-value vital-yellow">{current.rr}</p>
            <p className="vital-unit">rpm</p>
          </div>
          <button type="button" className="vital-module vital-module-ai" onClick={() => navigate(`/patient/${patient.id}`)}>
            <p className="vital-label">NeoSense AI</p>
            <p className="vital-value vital-soft-cyan">{aiRisk}%</p>
            <p className="ai-subvalue">Apnea {current.predictionWindowSec}s {aiRisk}% | {riskLabel}</p>
            <p className="ai-status">{current.recommendation}</p>
            <p className="ai-layer-label">AI Insight Layer</p>
          </button>
        </aside>
      </section>
    </main>
  );
}
