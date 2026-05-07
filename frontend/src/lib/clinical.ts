import type { EventType, PatientState, Recommendation, RiskLevel, Sample, SpO2Class } from "../types";

const mean = (values: number[]): number =>
  values.reduce((acc, v) => acc + v, 0) / Math.max(values.length, 1);

const std = (values: number[]): number => {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
};

export const classifySpO2 = (spo2: number): SpO2Class => {
  if (spo2 < 90) return "Desaturation";
  if (spo2 <= 95) return "Normoxemia";
  return "Hyperoxia";
};

export const classifyRisk = (probability: number): RiskLevel => {
  if (probability < 0.3) return "Low";
  if (probability <= 0.7) return "Moderate";
  return "High";
};

const detectBradycardia = (window: Sample[]): boolean => {
  let run = 0;
  for (const sample of window.slice(-10)) {
    if (sample.hr < 100) {
      run += 1;
      if (run >= 2) return true;
    } else {
      run = 0;
    }
  }
  return false;
};

const detectAOP = (window: Sample[], baselineSpO2: number): boolean => {
  let rrLowRun = 0;
  let maxLowRun = 0;
  for (const sample of window) {
    if (sample.rr < 5) {
      rrLowRun += 1;
      maxLowRun = Math.max(maxLowRun, rrLowRun);
    } else {
      rrLowRun = 0;
    }
  }
  const lowestSpO2 = Math.min(...window.map((s) => s.spo2));
  return maxLowRun >= 20 && baselineSpO2 - lowestSpO2 >= 5;
};

const detectPB = (window: Sample[]): boolean => {
  const pauses: number[] = [];
  let run = 0;

  for (const sample of window) {
    if (sample.rr < 5) {
      run += 1;
    } else if (run > 0) {
      pauses.push(run);
      run = 0;
    }
  }
  if (run > 0) pauses.push(run);

  const qualifyingPauses = pauses.filter((p) => p >= 5 && p <= 10).length;
  const spo2Std = std(window.map((s) => s.spo2));
  const hrStd = std(window.map((s) => s.hr));

  return qualifyingPauses >= 3 && spo2Std <= 3 && hrStd <= 8;
};

export const detectEvent = (window: Sample[], baselineSpO2: number): EventType => {
  if (detectAOP(window, baselineSpO2)) return "AOP";
  if (detectBradycardia(window)) return "Bradycardia";
  if (detectPB(window)) return "PB";
  return "None";
};

export const getRecommendation = (event: EventType, risk: RiskLevel): Recommendation => {
  if (event === "AOP" || event === "Bradycardia") return "EMERGENCY";
  if (risk === "High") return "URGENT";
  if (risk === "Moderate") return "CAUTION";
  if (event === "PB" && risk === "Low") return "INFORMATIONAL";
  return "ROUTINE";
};

export const classifyPatientState = (risk: RiskLevel, event: EventType): PatientState => {
  if (event === "AOP" || event === "Bradycardia" || risk === "High") return "Critical";
  if (event === "PB" || risk === "Moderate") return "Needs Attention";
  return "Stable";
};

export const pickPredictionWindowSec = (probability: number): number => {
  if (probability >= 0.85) return 30;
  if (probability >= 0.65) return 45;
  if (probability >= 0.45) return 60;
  if (probability >= 0.3) return 90;
  return 120;
};

export const suggestedInterventions = (state: PatientState, event: EventType, spo2: number, rr: number, hr = 130): string[] => {
  if (state !== "Critical") {
    return ["Continue close monitoring and reassess trends every 2 minutes."];
  }

  const interventions: string[] = [
    "Check airway patency and infant positioning immediately.",
    "Escalate bedside assessment to senior NICU clinician.",
  ];
  if (event === "Bradycardia" || hr < 100) {
    interventions.push("Tactile stimulation and reassess HR within 30 seconds.");
    interventions.push("Verify ECG lead contact and review caffeine therapy timing.");
  }
  if (spo2 < 90) interventions.push("Assess oxygen delivery setup and consider gentle stimulation per protocol.");
  if (rr < 5) interventions.push("Prepare for supported ventilation per unit protocol if apnea persists.");
  if (event === "AOP") interventions.push("Review caffeine therapy timing and recent apnea burden.");
  return interventions;
};
