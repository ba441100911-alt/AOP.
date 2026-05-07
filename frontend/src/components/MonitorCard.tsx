import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Patient } from "../types";
import { Badge } from "./ui/Badge";

interface Props {
  patient: Patient;
  compact?: boolean;
}

const eventLabels = {
  AOP: "URGENT AOP",
  Bradycardia: "BRADY",
  PB: "PB Pattern",
  None: "Stable",
};

export function MonitorCard({ patient, compact = false }: Props) {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const current = patient.samples[patient.samples.length - 1];
  const ecgData = patient.samples.slice(-80).map((s) => ({ t: s.t, ecg: s.ecg }));
  const riskPercent = Math.round(current.probability * 100);
  const aiStatus = current.patientState === "Critical" ? "HIGH" : current.patientState === "Needs Attention" ? "MOD" : "LOW";
  const aiTone = aiStatus === "HIGH" ? "danger" : aiStatus === "MOD" ? "warning" : "success";

  const openInsightLayer = () => {
    setLaunching(true);
    window.setTimeout(() => {
      navigate(`/patient/${patient.id}`);
    }, 900);
  };

  return (
    <>
      <article className="monitor-card">
        <div className="monitor-header">
          <div>
            <p className="monitor-room">{patient.roomId}</p>
            <p className="monitor-name">
              {patient.name} - {patient.bedLabel}
            </p>
          </div>
          <Badge tone={current.event === "AOP" || current.event === "Bradycardia" ? "danger" : current.event === "PB" ? "warning" : "neutral"}>{eventLabels[current.event]}</Badge>
        </div>

        <div className={`wave-box ${compact ? "compact" : ""}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ecgData}>
              <YAxis hide domain={[-40, 40]} />
              <Line type="monotone" dataKey="ecg" stroke="#44d67f" strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="vitals-grid">
          <div className="vital-box">
            <p className="vital-label">HR</p>
            <p className="vital-value vital-green">{current.hr}</p>
          </div>
          <div className="vital-box">
            <p className="vital-label">
              SpO2 {current.spo2Simulated ? <span className="vital-sim-tag">SIM</span> : null}
            </p>
            <p className="vital-value vital-cyan">{current.spo2}</p>
          </div>
          <div className="vital-box">
            <p className="vital-label">RR</p>
            <p className="vital-value vital-yellow">{current.rr}</p>
          </div>
          <button type="button" className="vital-box ai-action" onClick={openInsightLayer}>
            <p className="vital-label">AI</p>
            <p className="vital-value vital-ai">{riskPercent}%</p>
            <p className="m-0 text-[0.62rem] text-[#97b8cd]">Apnea {current.predictionWindowSec}s</p>
            <div className="mt-1">
              <Badge tone={aiTone}>{aiStatus}</Badge>
            </div>
          </button>
        </div>
      </article>
      {launching ? (
        <div className="launch-overlay">
          <div className="launch-dialog">Opening NeoSense AI Insight Layer for {patient.name}</div>
        </div>
      ) : null}
    </>
  );
}
