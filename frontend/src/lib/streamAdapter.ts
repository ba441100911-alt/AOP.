import type { EventType, PatientState, Recommendation, RiskLevel, Sample, SpO2Class } from "../types";

interface BackendStreamPayload {
  patient_id: string;
  room_id: string;
  hr: number;
  spo2: number;
  spo2_simulated?: boolean;
  rr: number;
  probability: number;
  prediction_window_sec: number;
  risk: RiskLevel;
  patient_state: PatientState;
  event: EventType;
  daily_event_count: number;
  last_event_ts?: number;
  spo2_classification: SpO2Class;
  recommendation: Recommendation;
  interventions: string[];
  data_source?: string;
}

const STREAM_URL = import.meta.env.VITE_NEOSENSE_STREAM_URL as string | undefined;

export const fetchBackendStreamFrame = async (): Promise<BackendStreamPayload | null> => {
  if (!STREAM_URL) {
    return null;
  }

  try {
    const response = await fetch(STREAM_URL, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Partial<BackendStreamPayload>;
    if (!payload.patient_id || typeof payload.hr !== "number" || typeof payload.probability !== "number") {
      return null;
    }

    return payload as BackendStreamPayload;
  } catch {
    return null;
  }
};

export const mapBackendPayloadToSample = (payload: BackendStreamPayload, t: number): Sample => ({
  t,
  hr: Math.round(payload.hr),
  spo2: Number(payload.spo2.toFixed(1)),
  rr: Math.round(payload.rr),
  ecg: Math.sin(t / 5) * 20 + Math.sin(t * 3.3) * 7,
  probability: Number(payload.probability.toFixed(2)),
  risk: payload.risk,
  event: payload.event,
  predictionWindowSec: payload.prediction_window_sec,
  patientState: payload.patient_state,
  lastEventTs: payload.last_event_ts,
  recommendation: payload.recommendation,
  interventions: payload.interventions,
  spo2Class: payload.spo2_classification,
  spo2Simulated: payload.spo2_simulated ?? true,
  dataSource: payload.data_source,
});

