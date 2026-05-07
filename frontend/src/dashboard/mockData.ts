import type { DashboardSnapshot, PredictionEntry, RiskPoint, SignalPoint } from "./types";

const RISK_WINDOW = 26;
const SIGNAL_WINDOW = 48;
const PREDICTION_WINDOW = 8;

const statusFromRisk = (risk: number): DashboardSnapshot["status"] => {
  if (risk >= 0.7) {
    return "High";
  }
  if (risk >= 0.4) {
    return "Medium";
  }
  return "Low";
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatTime = (date: Date) =>
  `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;

export const initialSnapshot: DashboardSnapshot = {
  accuracy: 0.86,
  precision: 0.82,
  recall: 0.89,
  f1: 0.85,
  currentRisk: 0.76,
  status: "High",
  probability: 0.82,
  timeToRiskSeconds: 60,
};

export const createInitialSignal = (): SignalPoint[] => {
  const now = Date.now();
  return Array.from({ length: SIGNAL_WINDOW }, (_, index) => {
    const t = now - (SIGNAL_WINDOW - index) * 1000;
    const phase = index / 2.7;
    return {
      time: formatTime(new Date(t)),
      value: 78 + Math.sin(phase) * 18 + Math.cos(phase * 1.8) * 8,
    };
  });
};

export const createInitialRisk = (): RiskPoint[] => {
  const now = Date.now();
  return Array.from({ length: RISK_WINDOW }, (_, index) => {
    const t = now - (RISK_WINDOW - index) * 1000;
    const value = 0.62 + Math.sin(index / 4.5) * 0.12;
    return {
      time: formatTime(new Date(t)),
      risk: clamp(value, 0.1, 0.98),
    };
  });
};

export const createInitialPredictions = (): PredictionEntry[] => {
  const baseRisk = [0.54, 0.57, 0.61, 0.66, 0.71, 0.76, 0.74, 0.78];
  const now = Date.now();

  return baseRisk.slice(-PREDICTION_WINDOW).map((risk, index) => {
    const t = now - (PREDICTION_WINDOW - index) * 8000;
    return {
      id: `pred-${index}`,
      time: formatTime(new Date(t)),
      risk,
      status: statusFromRisk(risk),
    };
  });
};

export const createNextFrame = (
  previous: DashboardSnapshot,
): Pick<DashboardSnapshot, "currentRisk" | "probability" | "status" | "timeToRiskSeconds"> => {
  const wave = Math.sin(Date.now() / 5200) * 0.018;
  const noise = (Math.random() - 0.5) * 0.035;
  const currentRisk = clamp(previous.currentRisk + wave + noise, 0.08, 0.97);
  const probability = clamp(currentRisk + 0.06 + (Math.random() - 0.5) * 0.03, 0.06, 0.99);
  const status = statusFromRisk(currentRisk);
  const timeToRiskSeconds = Math.round(clamp((1 - currentRisk) * 250, 20, 180));

  return {
    currentRisk,
    probability,
    status,
    timeToRiskSeconds,
  };
};
