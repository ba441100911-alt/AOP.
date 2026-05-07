import {
  classifyPatientState,
  classifyRisk,
  classifySpO2,
  detectEvent,
  getRecommendation,
  pickPredictionWindowSec,
  suggestedInterventions,
} from "./clinical";
import type { Patient, Sample } from "../types";

const WAVEFORM_SIZE = 180;
const WINDOW_SIZE = 120;

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const randomNoise = (scale: number): number => (Math.random() - 0.5) * scale;

const ecgValue = (t: number): number => {
  const base = Math.sin(t / 5) * 22;
  const qrs = Math.sin(t * 3.4) * 8;
  return base + qrs + randomNoise(2);
};

const nextVitals = (last: Sample): Pick<Sample, "hr" | "spo2" | "rr" | "ecg"> => {
  const hr = clamp(last.hr + randomNoise(6), 75, 170);
  const spo2 = clamp(last.spo2 + randomNoise(1.8), 83, 100);
  const rr = clamp(last.rr + randomNoise(3), 2, 45);
  const ecg = ecgValue(last.t + 1);
  return { hr: Math.round(hr), spo2: Number(spo2.toFixed(1)), rr: Math.round(rr), ecg };
};

export const seedPatient = (
  id: string,
  roomId: string,
  name: string,
  bedLabel: string,
  gestationalAgeWeeks: number,
): Patient => {
  const baselineSpO2 = 96 + Math.random() * 2;
  const samples: Sample[] = [];

  for (let i = 0; i < WAVEFORM_SIZE; i += 1) {
    const hr = 115 + Math.random() * 15;
    const spo2 = baselineSpO2 + randomNoise(1.4);
    const rr = 18 + randomNoise(4);
    const probability = 0.2 + Math.random() * 0.2;
    const risk = classifyRisk(probability);
    const event = "None";
    samples.push({
      t: i,
      hr: Math.round(hr),
      spo2: Number(clamp(spo2, 84, 100).toFixed(1)),
      rr: Math.round(clamp(rr, 4, 40)),
      ecg: ecgValue(i),
      probability: Number(probability.toFixed(2)),
      risk,
      event,
      predictionWindowSec: pickPredictionWindowSec(probability),
      patientState: classifyPatientState(risk, event),
      lastEventTs: undefined,
      recommendation: getRecommendation(event, risk),
      interventions: suggestedInterventions(classifyPatientState(risk, event), event, spo2, rr, hr),
      spo2Class: classifySpO2(spo2),
      spo2Simulated: true,
      dataSource: "Local simulation",
    });
  }

  return {
    id,
    roomId,
    name,
    bedLabel,
    gestationalAgeWeeks,
    baselineSpO2: Number(baselineSpO2.toFixed(1)),
    samples,
  };
};

export const tickPatient = (patient: Patient): Patient => {
  const last = patient.samples[patient.samples.length - 1];
  const vitals = nextVitals(last);

  const precomputedSample: Sample = {
    t: last.t + 1,
    ...vitals,
    probability: 0,
    risk: "Low",
    event: "None",
    predictionWindowSec: 120,
    patientState: "Stable",
    lastEventTs: undefined,
    recommendation: "ROUTINE",
    interventions: ["Continue close monitoring and reassess trends every 2 minutes."],
    spo2Class: classifySpO2(vitals.spo2),
    spo2Simulated: true,
    dataSource: "Local simulation",
  };

  const draft = [...patient.samples.slice(-WINDOW_SIZE + 1), precomputedSample];
  const event = detectEvent(draft, patient.baselineSpO2);
  const rawProbability =
    0.2 +
    (Math.max(0, 6 - vitals.rr) / 10) * 0.4 +
    (Math.max(0, 93 - vitals.spo2) / 20) * 0.2 +
    (event === "AOP" || event === "Bradycardia" ? 0.35 : event === "PB" ? 0.15 : 0) +
    Math.random() * 0.08;

  const probability = clamp(rawProbability, 0.01, 0.99);
  const risk = classifyRisk(probability);
  const patientState = classifyPatientState(risk, event);
  const prevEventTs = [...patient.samples].reverse().find((s) => s.event !== "None")?.t;

  const nextSample: Sample = {
    ...precomputedSample,
    probability: Number(probability.toFixed(2)),
    risk,
    event,
    predictionWindowSec: pickPredictionWindowSec(probability),
    patientState,
    lastEventTs: event !== "None" ? precomputedSample.t : prevEventTs,
    recommendation: getRecommendation(event, risk),
    interventions: suggestedInterventions(patientState, event, vitals.spo2, vitals.rr, vitals.hr),
  };

  return {
    ...patient,
    samples: [...patient.samples.slice(-WAVEFORM_SIZE + 1), nextSample],
  };
};
