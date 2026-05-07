export type Role = "admin" | "nurse";

export type RiskLevel = "Low" | "Moderate" | "High";
export type EventType = "AOP" | "PB" | "Bradycardia" | "None";
export type PatientState = "Critical" | "Needs Attention" | "Stable";
export type Recommendation =
  | "ROUTINE"
  | "CAUTION"
  | "URGENT"
  | "EMERGENCY"
  | "INFORMATIONAL";

export type SpO2Class = "Desaturation" | "Normoxemia" | "Hyperoxia";

export interface Sample {
  t: number;
  hr: number;
  spo2: number;
  rr: number;
  ecg: number;
  probability: number;
  risk: RiskLevel;
  event: EventType;
  predictionWindowSec: number;
  patientState: PatientState;
  lastEventTs?: number;
  recommendation: Recommendation;
  interventions: string[];
  spo2Class: SpO2Class;
  spo2Simulated?: boolean;
  dataSource?: string;
}

export interface Patient {
  id: string;
  name: string;
  roomId: string;
  bedLabel: string;
  gestationalAgeWeeks: number;
  baselineSpO2: number;
  samples: Sample[];
}

export interface NurseAssignment {
  primaryPatientId: string;
  secondaryPatientId?: string;
}
