export type RiskLevel = "Low" | "Moderate" | "High";

export type TimeSeriesPoint = {
  time: string;
  value: number;
};

export type PredictionRow = {
  id: string;
  time: string;
  apneaProbability: number;
  riskLevel: RiskLevel;
  hr: number;
  rr: number;
  spo2: number;
  recommendation: string;
};

export type PatientEventSummary = {
  currentStatus: "Monitoring" | "AOP Detected" | "Recovery";
  aopLastHour: number;
  aopLast24h: number;
  periodicBreathingEpisodes: number;
  lastDetectedEvent: string;
  severity: "Mild" | "Moderate" | "Severe";
  recoveryStatus: "Stable" | "Ongoing";
};

export type PatientProfile = {
  id: string;
  name: string;
  mrn: string;
  gestationalAgeWeeks: number;
  birthWeightGrams: number;
  sex: "Male" | "Female";
  dayOfLife: number;
  diagnosis: string;
  respiratorySupport: string;
  bed: string;
  lastEventTime: string;
  currentPhase: string;
  vitals: {
    heartRate: number;
    spo2: number;
    respiratoryRate: number;
    apneaProbability: number;
    signalQuality: number;
    predictionHorizon: 30 | 60 | 120;
    confidence: number;
  };
  eventSummary: PatientEventSummary;
  ecgWaveform: TimeSeriesPoint[];
  respiratoryTrend: TimeSeriesPoint[];
  spo2Trend: TimeSeriesPoint[];
  apneaRiskTrend: TimeSeriesPoint[];
  multiHorizonRisk: Array<{ time: string; risk30: number; risk60: number; risk120: number }>;
  predictions: PredictionRow[];
};

const t = (offset: number) => {
  const date = new Date(Date.now() - offset * 1000);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date
    .getSeconds()
    .toString()
    .padStart(2, "0")}`;
};

const series = (count: number, base: number, amplitude: number, speed: number, drift = 0): TimeSeriesPoint[] =>
  Array.from({ length: count }, (_, idx) => ({
    time: t(count - idx),
    value: base + Math.sin(idx / speed) * amplitude + Math.cos(idx / (speed * 0.8)) * (amplitude * 0.45) + idx * drift,
  }));

const riskFromProbability = (probability: number): RiskLevel => {
  if (probability > 0.7) return "High";
  if (probability >= 0.3) return "Moderate";
  return "Low";
};

const recommendationByRisk: Record<RiskLevel, string> = {
  Low: "Continue routine monitoring",
  Moderate: "Increase observation frequency",
  High: "Immediate bedside assessment",
};

const predictionRows = (seed: string, baseRisk: number): PredictionRow[] =>
  Array.from({ length: 10 }, (_, idx) => {
    const apneaProbability = Math.max(0.04, Math.min(0.95, baseRisk + Math.sin(idx / 2.4) * 0.11));
    const riskLevel = riskFromProbability(apneaProbability);
    return {
      id: `${seed}-${idx}`,
      time: t((10 - idx) * 14),
      apneaProbability,
      riskLevel,
      hr: Math.round(142 + Math.sin(idx / 1.8) * 9),
      rr: Math.round(39 + Math.cos(idx / 1.6) * 5),
      spo2: Math.round(93 + Math.sin(idx / 3.1) * 3),
      recommendation: recommendationByRisk[riskLevel],
    };
  }).reverse();

export const modelPerformance = {
  accuracy: 0.86,
  precision: 0.82,
  recall: 0.89,
  f1: 0.85,
  datasetSource: "Local real-data simulation based on open clinical datasets",
  validationStatus: "Preliminary offline evaluation",
};

export const nicuPatients: PatientProfile[] = [
  {
    id: "NEO-001",
    name: "Baby Al-Farsi",
    mrn: "MRN-08421",
    gestationalAgeWeeks: 28,
    birthWeightGrams: 1050,
    sex: "Male",
    dayOfLife: 3,
    diagnosis: "Apnea of prematurity - active apnea alarm",
    respiratorySupport: "Nasal CPAP 5 cmH2O",
    bed: "Incubator B-05",
    lastEventTime: "11:24:38",
    currentPhase: "Active apnea event",
    vitals: {
      heartRate: 92,
      spo2: 76,
      respiratoryRate: 0,
      apneaProbability: 0.96,
      signalQuality: 0.94,
      predictionHorizon: 60,
      confidence: 0.91,
    },
    eventSummary: {
      currentStatus: "AOP Detected",
      aopLastHour: 2,
      aopLast24h: 10,
      periodicBreathingEpisodes: 24,
      lastDetectedEvent: "11:24:38",
      severity: "Severe",
      recoveryStatus: "Ongoing",
    },
    ecgWaveform: series(72, 84, 18, 1.95),
    respiratoryTrend: series(40, 14, 3, 2.8, -0.35),
    spo2Trend: series(40, 82, 2.5, 3.5, -0.15),
    apneaRiskTrend: series(40, 0.7, 0.12, 3.3, 0.006),
    multiHorizonRisk: series(30, 0.72, 0.12, 2.9, 0.006).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.05, Math.min(0.99, point.value + 0.04 + Math.sin(idx / 2) * 0.02)),
      risk60: Math.max(0.05, Math.min(0.99, point.value + 0.07)),
      risk120: Math.max(0.05, Math.min(0.99, point.value + 0.11)),
    })),
    predictions: predictionRows("neo-001", 0.9),
  },
  {
    id: "NEO-002",
    name: "Baby Rahman",
    mrn: "MRN-08513",
    gestationalAgeWeeks: 31,
    birthWeightGrams: 1420,
    sex: "Female",
    dayOfLife: 6,
    diagnosis: "Late preterm cardiorespiratory instability",
    respiratorySupport: "High-flow nasal cannula 3 L/min",
    bed: "Incubator B-01",
    lastEventTime: "13:57:44",
    currentPhase: "Baseline stabilization",
    vitals: {
      heartRate: 144,
      spo2: 95,
      respiratoryRate: 38,
      apneaProbability: 0.36,
      signalQuality: 0.91,
      predictionHorizon: 120,
      confidence: 0.83,
    },
    eventSummary: {
      currentStatus: "Recovery",
      aopLastHour: 1,
      aopLast24h: 4,
      periodicBreathingEpisodes: 3,
      lastDetectedEvent: "13:57:44",
      severity: "Mild",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 79, 14, 2.5),
    respiratoryTrend: series(40, 38, 3.2, 3.2),
    spo2Trend: series(40, 95, 1.7, 3.7),
    apneaRiskTrend: series(40, 0.33, 0.09, 3.5),
    multiHorizonRisk: series(30, 0.31, 0.08, 3.1).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.03, Math.min(0.9, point.value)),
      risk60: Math.max(0.03, Math.min(0.9, point.value + 0.03 + Math.sin(idx / 4) * 0.015)),
      risk120: Math.max(0.03, Math.min(0.9, point.value + 0.06)),
    })),
    predictions: predictionRows("neo-002", 0.34),
  },
  {
    id: "NEO-003",
    name: "Baby Khalid",
    mrn: "MRN-08372",
    gestationalAgeWeeks: 26,
    birthWeightGrams: 820,
    sex: "Male",
    dayOfLife: 14,
    diagnosis: "Extreme prematurity with recurrent AOP",
    respiratorySupport: "NIPPV backup rate 25",
    bed: "Incubator C-02",
    lastEventTime: "14:29:02",
    currentPhase: "High-risk watch",
    vitals: {
      heartRate: 156,
      spo2: 90,
      respiratoryRate: 47,
      apneaProbability: 0.81,
      signalQuality: 0.9,
      predictionHorizon: 30,
      confidence: 0.9,
    },
    eventSummary: {
      currentStatus: "AOP Detected",
      aopLastHour: 4,
      aopLast24h: 16,
      periodicBreathingEpisodes: 8,
      lastDetectedEvent: "14:29:02",
      severity: "Severe",
      recoveryStatus: "Ongoing",
    },
    ecgWaveform: series(72, 84, 18, 1.95),
    respiratoryTrend: series(40, 47, 6.1, 2.5),
    spo2Trend: series(40, 90, 3.4, 2.8),
    apneaRiskTrend: series(40, 0.76, 0.16, 2.6),
    multiHorizonRisk: series(30, 0.71, 0.14, 2.4).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.08, Math.min(0.99, point.value + 0.04)),
      risk60: Math.max(0.08, Math.min(0.99, point.value + 0.08 + Math.sin(idx / 3) * 0.02)),
      risk120: Math.max(0.08, Math.min(0.99, point.value + 0.12)),
    })),
    predictions: predictionRows("neo-003", 0.79),
  },
  {
    id: "NEO-004",
    name: "Baby Nasser",
    mrn: "MRN-08546",
    gestationalAgeWeeks: 30,
    birthWeightGrams: 1280,
    sex: "Female",
    dayOfLife: 7,
    diagnosis: "Prematurity with intermittent desaturation",
    respiratorySupport: "Low-flow oxygen 0.5 L/min",
    bed: "Incubator A-06",
    lastEventTime: "12:44:18",
    currentPhase: "Sleep cycle monitoring",
    vitals: {
      heartRate: 141,
      spo2: 94,
      respiratoryRate: 36,
      apneaProbability: 0.24,
      signalQuality: 0.95,
      predictionHorizon: 120,
      confidence: 0.81,
    },
    eventSummary: {
      currentStatus: "Monitoring",
      aopLastHour: 0,
      aopLast24h: 2,
      periodicBreathingEpisodes: 2,
      lastDetectedEvent: "12:44:18",
      severity: "Mild",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 77, 12, 2.8),
    respiratoryTrend: series(40, 36, 2.9, 3.3),
    spo2Trend: series(40, 94, 1.8, 4.2),
    apneaRiskTrend: series(40, 0.25, 0.08, 3.8),
    multiHorizonRisk: series(30, 0.22, 0.06, 3.4).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.02, Math.min(0.75, point.value)),
      risk60: Math.max(0.02, Math.min(0.75, point.value + 0.02 + Math.sin(idx / 5) * 0.01)),
      risk120: Math.max(0.02, Math.min(0.75, point.value + 0.04)),
    })),
    predictions: predictionRows("neo-004", 0.23),
  },
  {
    id: "NEO-005",
    name: "Baby Yasmin",
    mrn: "MRN-08611",
    gestationalAgeWeeks: 27,
    birthWeightGrams: 930,
    sex: "Female",
    dayOfLife: 11,
    diagnosis: "Very preterm infant with apnea surveillance",
    respiratorySupport: "Nasal CPAP 6 cmH2O",
    bed: "Incubator B-04",
    lastEventTime: "15:02:19",
    currentPhase: "Post-care bundle",
    vitals: {
      heartRate: 152,
      spo2: 91,
      respiratoryRate: 45,
      apneaProbability: 0.72,
      signalQuality: 0.89,
      predictionHorizon: 60,
      confidence: 0.88,
    },
    eventSummary: {
      currentStatus: "AOP Detected",
      aopLastHour: 3,
      aopLast24h: 12,
      periodicBreathingEpisodes: 7,
      lastDetectedEvent: "15:02:19",
      severity: "Severe",
      recoveryStatus: "Ongoing",
    },
    ecgWaveform: series(72, 83, 16, 2.0),
    respiratoryTrend: series(40, 45, 5.2, 2.6),
    spo2Trend: series(40, 91, 3.0, 2.9),
    apneaRiskTrend: series(40, 0.7, 0.14, 2.8),
    multiHorizonRisk: series(30, 0.66, 0.13, 2.6).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.06, Math.min(0.99, point.value + 0.03)),
      risk60: Math.max(0.06, Math.min(0.99, point.value + 0.07 + Math.sin(idx / 3) * 0.02)),
      risk120: Math.max(0.06, Math.min(0.99, point.value + 0.11)),
    })),
    predictions: predictionRows("neo-005", 0.71),
  },
  {
    id: "NEO-006",
    name: "Baby Omar",
    mrn: "MRN-08638",
    gestationalAgeWeeks: 32,
    birthWeightGrams: 1580,
    sex: "Male",
    dayOfLife: 5,
    diagnosis: "Late preterm transitional respiratory instability",
    respiratorySupport: "Room air with intermittent HFNC",
    bed: "Incubator C-05",
    lastEventTime: "14:51:08",
    currentPhase: "Feed tolerance monitoring",
    vitals: {
      heartRate: 139,
      spo2: 96,
      respiratoryRate: 34,
      apneaProbability: 0.19,
      signalQuality: 0.96,
      predictionHorizon: 120,
      confidence: 0.8,
    },
    eventSummary: {
      currentStatus: "Monitoring",
      aopLastHour: 0,
      aopLast24h: 1,
      periodicBreathingEpisodes: 1,
      lastDetectedEvent: "14:51:08",
      severity: "Mild",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 76, 11, 3.0),
    respiratoryTrend: series(40, 34, 2.6, 3.5),
    spo2Trend: series(40, 96, 1.4, 4.0),
    apneaRiskTrend: series(40, 0.2, 0.07, 3.9),
    multiHorizonRisk: series(30, 0.18, 0.05, 3.6).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.02, Math.min(0.7, point.value)),
      risk60: Math.max(0.02, Math.min(0.7, point.value + 0.02 + Math.sin(idx / 4) * 0.01)),
      risk120: Math.max(0.02, Math.min(0.7, point.value + 0.04)),
    })),
    predictions: predictionRows("neo-006", 0.2),
  },
  {
    id: "NEO-007",
    name: "Baby Hana",
    mrn: "MRN-08672",
    gestationalAgeWeeks: 29,
    birthWeightGrams: 1180,
    sex: "Female",
    dayOfLife: 13,
    diagnosis: "Prematurity with periodic breathing episodes",
    respiratorySupport: "NIPPV intermittent",
    bed: "Incubator A-08",
    lastEventTime: "15:11:35",
    currentPhase: "Sleep-state observation",
    vitals: {
      heartRate: 149,
      spo2: 92,
      respiratoryRate: 43,
      apneaProbability: 0.57,
      signalQuality: 0.92,
      predictionHorizon: 60,
      confidence: 0.86,
    },
    eventSummary: {
      currentStatus: "Monitoring",
      aopLastHour: 2,
      aopLast24h: 8,
      periodicBreathingEpisodes: 6,
      lastDetectedEvent: "15:11:35",
      severity: "Moderate",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 81, 15, 2.2),
    respiratoryTrend: series(40, 43, 4.4, 2.9),
    spo2Trend: series(40, 92, 2.4, 3.1),
    apneaRiskTrend: series(40, 0.55, 0.12, 3.1),
    multiHorizonRisk: series(30, 0.52, 0.1, 2.9).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.04, Math.min(0.94, point.value + Math.sin(idx / 2) * 0.02)),
      risk60: Math.max(0.04, Math.min(0.94, point.value + 0.04)),
      risk120: Math.max(0.04, Math.min(0.94, point.value + 0.08)),
    })),
    predictions: predictionRows("neo-007", 0.56),
  },
  {
    id: "NEO-008",
    name: "Baby Kareem",
    mrn: "MRN-08703",
    gestationalAgeWeeks: 25,
    birthWeightGrams: 760,
    sex: "Male",
    dayOfLife: 16,
    diagnosis: "Extremely preterm infant with recurrent desaturation",
    respiratorySupport: "Mechanical ventilation SIMV",
    bed: "Incubator C-01",
    lastEventTime: "15:18:27",
    currentPhase: "High-acuity stabilization",
    vitals: {
      heartRate: 161,
      spo2: 88,
      respiratoryRate: 50,
      apneaProbability: 0.88,
      signalQuality: 0.87,
      predictionHorizon: 30,
      confidence: 0.91,
    },
    eventSummary: {
      currentStatus: "AOP Detected",
      aopLastHour: 5,
      aopLast24h: 19,
      periodicBreathingEpisodes: 9,
      lastDetectedEvent: "15:18:27",
      severity: "Severe",
      recoveryStatus: "Ongoing",
    },
    ecgWaveform: series(72, 86, 19, 1.8),
    respiratoryTrend: series(40, 50, 6.4, 2.3),
    spo2Trend: series(40, 88, 3.8, 2.5),
    apneaRiskTrend: series(40, 0.84, 0.17, 2.2),
    multiHorizonRisk: series(30, 0.8, 0.15, 2.1).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.1, Math.min(0.99, point.value + 0.05)),
      risk60: Math.max(0.1, Math.min(0.99, point.value + 0.09 + Math.sin(idx / 3) * 0.02)),
      risk120: Math.max(0.1, Math.min(0.99, point.value + 0.13)),
    })),
    predictions: predictionRows("neo-008", 0.86),
  },
  {
    id: "NEO-009",
    name: "Baby Leen",
    mrn: "MRN-08739",
    gestationalAgeWeeks: 30,
    birthWeightGrams: 1320,
    sex: "Female",
    dayOfLife: 8,
    diagnosis: "Preterm infant under caffeine therapy",
    respiratorySupport: "Low-flow nasal cannula 1 L/min",
    bed: "Incubator B-06",
    lastEventTime: "14:39:50",
    currentPhase: "Routine surveillance",
    vitals: {
      heartRate: 146,
      spo2: 94,
      respiratoryRate: 39,
      apneaProbability: 0.41,
      signalQuality: 0.93,
      predictionHorizon: 120,
      confidence: 0.84,
    },
    eventSummary: {
      currentStatus: "Recovery",
      aopLastHour: 1,
      aopLast24h: 5,
      periodicBreathingEpisodes: 4,
      lastDetectedEvent: "14:39:50",
      severity: "Moderate",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 80, 13, 2.6),
    respiratoryTrend: series(40, 39, 3.5, 3.0),
    spo2Trend: series(40, 94, 2.0, 3.6),
    apneaRiskTrend: series(40, 0.39, 0.1, 3.4),
    multiHorizonRisk: series(30, 0.36, 0.09, 3.2).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.03, Math.min(0.89, point.value)),
      risk60: Math.max(0.03, Math.min(0.89, point.value + 0.03 + Math.sin(idx / 4) * 0.015)),
      risk120: Math.max(0.03, Math.min(0.89, point.value + 0.06)),
    })),
    predictions: predictionRows("neo-009", 0.4),
  },
  {
    id: "NEO-010",
    name: "Baby Zayd",
    mrn: "MRN-08788",
    gestationalAgeWeeks: 33,
    birthWeightGrams: 1710,
    sex: "Male",
    dayOfLife: 4,
    diagnosis: "Late preterm observation after early desaturation",
    respiratorySupport: "Room air",
    bed: "Incubator A-01",
    lastEventTime: "13:22:06",
    currentPhase: "Step-down observation",
    vitals: {
      heartRate: 137,
      spo2: 97,
      respiratoryRate: 32,
      apneaProbability: 0.14,
      signalQuality: 0.97,
      predictionHorizon: 120,
      confidence: 0.79,
    },
    eventSummary: {
      currentStatus: "Monitoring",
      aopLastHour: 0,
      aopLast24h: 0,
      periodicBreathingEpisodes: 1,
      lastDetectedEvent: "13:22:06",
      severity: "Mild",
      recoveryStatus: "Stable",
    },
    ecgWaveform: series(72, 75, 10, 3.2),
    respiratoryTrend: series(40, 32, 2.3, 3.8),
    spo2Trend: series(40, 97, 1.2, 4.3),
    apneaRiskTrend: series(40, 0.15, 0.06, 4.1),
    multiHorizonRisk: series(30, 0.13, 0.04, 3.8).map((point, idx) => ({
      time: point.time,
      risk30: Math.max(0.01, Math.min(0.6, point.value)),
      risk60: Math.max(0.01, Math.min(0.6, point.value + 0.02 + Math.sin(idx / 5) * 0.01)),
      risk120: Math.max(0.01, Math.min(0.6, point.value + 0.04)),
    })),
    predictions: predictionRows("neo-010", 0.14),
  },
];
