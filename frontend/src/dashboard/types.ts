export type RiskStatus = "Low" | "Medium" | "High";

export type DashboardSnapshot = {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  currentRisk: number;
  status: RiskStatus;
  probability: number;
  timeToRiskSeconds: number;
};

export type SignalPoint = {
  time: string;
  value: number;
};

export type RiskPoint = {
  time: string;
  risk: number;
};

export type PredictionEntry = {
  id: string;
  time: string;
  risk: number;
  status: RiskStatus;
};
