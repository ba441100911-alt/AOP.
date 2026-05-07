import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  FileText,
  GaugeCircle,
  Hash,
  Lightbulb,
  Printer,
  ShieldAlert,
  Signal,
  User,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { nicuPatients, type PatientProfile, type PredictionRow, type RiskLevel } from "../../data/nicuPatients";
import logo from "../../assets/neosense-logo.png";

const riskBadgeClass: Record<RiskLevel, string> = {
  Low: "border-emerald-300 bg-emerald-50 text-emerald-900",
  Moderate: "border-amber-300 bg-amber-50 text-amber-900",
  High: "border-rose-300 bg-rose-50 text-rose-900",
};

const riskIcon: Record<RiskLevel, typeof CheckCircle2> = {
  Low: CheckCircle2,
  Moderate: AlertTriangle,
  High: AlertOctagon,
};

const TARGET_CHILD_ID = "NEO-001";
const AOP_COOLDOWN_SECONDS = 20 * 60;
const AOP_MAX_PER_HOUR = 3;
const panelClass =
  "rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-[0_8px_26px_rgba(14,116,144,0.08)]";

const summaryTileClass =
  "rounded-lg border border-slate-200/90 bg-gradient-to-b from-white to-slate-50 px-2.5 py-2 transition-colors hover:border-slate-300 sm:px-3";

type VitalsSummaryProps = {
  heartRate: number;
  respiratoryRate: number;
  spo2: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const nowLabel = () => new Date().toLocaleTimeString();

const asRisk = (value: number): RiskLevel => {
  if (value > 0.7) return "High";
  if (value >= 0.3) return "Moderate";
  return "Low";
};

// Pulse only on attention-needed states, and only when motion is allowed (handled in CSS).
const riskPulseClass: Record<RiskLevel, string> = {
  Low: "",
  Moderate: "motion-safe:animate-pulse",
  High: "motion-safe:animate-pulse",
};

const riskAccentClass: Record<RiskLevel, string> = {
  Low: "text-emerald-800",
  Moderate: "text-amber-800",
  High: "text-rose-700",
};

const patientStatusSelectClass: Record<RiskLevel, string> = {
  Low: "border-emerald-300 bg-emerald-50 text-emerald-900 focus:border-emerald-500 focus:ring-emerald-200",
  Moderate: "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500 focus:ring-amber-200",
  High: "border-rose-300 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-rose-200",
};

const nextPoint = (base: number, amp: number, speed: number, idx: number) =>
  base + Math.sin((Date.now() + idx * 43) / speed) * amp + (Math.random() - 0.5) * (amp * 0.45);

const clinicalRecommendations: Record<RiskLevel, string[]> = {
  Low: ["Continue routine monitoring", "Maintain trend observation", "Reassess in 15 minutes"],
  Moderate: [
    "Increase observation frequency",
    "Verify sensor placement",
    "Prepare gentle stimulation if risk rises",
  ],
  High: [
    "Immediate bedside assessment",
    "Airway positioning",
    "Tactile stimulation",
    "Escalate to clinician if desaturation/bradycardia persists",
  ],
};

function VitalsSummary({ heartRate, respiratoryRate, spo2 }: VitalsSummaryProps) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Vital signs</dt>
      <dd className="mt-1 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-2 py-1">
          <p className="text-slate-500">HR</p>
          <p className="text-sm font-semibold text-brand-900">{heartRate} bpm</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-2 py-1">
          <p className="text-slate-500">RR</p>
          <p className="text-sm font-semibold text-brand-900">{respiratoryRate} bpm</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-2 py-1">
          <p className="text-slate-500">SpO₂</p>
          <p className="text-sm font-semibold text-brand-900">{spo2}%</p>
        </div>
      </dd>
    </div>
  );
}

export function DashboardLayout() {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMedicalActionsOpen, setIsMedicalActionsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const medicalActionsRef = useRef<HTMLDivElement | null>(null);
  const [patient, setPatient] = useState<PatientProfile>(
    () => nicuPatients.find((entry) => entry.id === TARGET_CHILD_ID) ?? nicuPatients[0],
  );
  const simIndexRef = useRef(0);
  const lastAnnouncedRiskRef = useRef<RiskLevel>("Low");
  const [criticalAnnouncement, setCriticalAnnouncement] = useState<string>("");
  const aopTrackerRef = useRef<Record<string, { elapsedSec: number; active: boolean; timestamps: number[] }>>({});

  useEffect(() => {
    const timer = window.setInterval(() => {
      simIndexRef.current += 1;
      setPatient((current) => {
        const apneaProbability = clamp(
          current.vitals.apneaProbability +
            Math.sin(Date.now() / 2400 + current.gestationalAgeWeeks) * 0.03 +
            (Math.random() - 0.5) * 0.04,
          0.05,
          0.96,
        );
        const hr = Math.round(clamp(nextPoint(current.vitals.heartRate, 6, 1100, current.dayOfLife), 60, 190));
        const rr = Math.round(
          clamp(nextPoint(current.vitals.respiratoryRate, 3.4, 1400, current.gestationalAgeWeeks), 0, 80),
        );
        const spo2 = Math.round(
          clamp(nextPoint(current.vitals.spo2, 1.9, 1500, current.birthWeightGrams), 60, 100),
        );
        const signalQuality = clamp(current.vitals.signalQuality + (Math.random() - 0.5) * 0.016, 0.82, 0.99);
        const confidence = clamp(0.77 + signalQuality * 0.22 + (Math.random() - 0.5) * 0.03, 0.78, 0.95);
        const riskLevel = asRisk(apneaProbability);
        const recommendation = clinicalRecommendations[riskLevel][0];
        const aopSignal = riskLevel === "High" && rr <= 6 && spo2 <= 90;
        const tracker = aopTrackerRef.current[current.id] ?? {
          elapsedSec: 0,
          active: false,
          timestamps: Array.from({ length: current.eventSummary.aopLast24h }, (_, idx) => -((idx + 1) * 1800)),
        };
        tracker.elapsedSec += 1;
        tracker.timestamps = tracker.timestamps.filter((ts) => (tracker.elapsedSec - ts) <= 86400);
        const aopInHour = tracker.timestamps.filter((ts) => (tracker.elapsedSec - ts) <= 3600).length;
        const cooldownPassed =
          tracker.timestamps.length === 0 ||
          (tracker.elapsedSec - tracker.timestamps[tracker.timestamps.length - 1]) >= AOP_COOLDOWN_SECONDS;
        if (aopSignal && !tracker.active && aopInHour < AOP_MAX_PER_HOUR && cooldownPassed) {
          tracker.timestamps.push(tracker.elapsedSec);
        }
        tracker.active = aopSignal;
        aopTrackerRef.current[current.id] = tracker;
        const nextAopLastHour = tracker.timestamps.filter((ts) => (tracker.elapsedSec - ts) <= 3600).length;
        const nextAopLast24h = tracker.timestamps.length;
        const nextPrediction: PredictionRow = {
          id: crypto.randomUUID(),
          time: nowLabel(),
          apneaProbability,
          riskLevel,
          hr,
          rr,
          spo2,
          recommendation,
        };
        const horizonRisk = {
          time: nowLabel(),
          risk30: clamp(apneaProbability - 0.05 + Math.random() * 0.05, 0.04, 0.99),
          risk60: clamp(apneaProbability, 0.04, 0.99),
          risk120: clamp(apneaProbability + 0.07 + Math.random() * 0.05, 0.04, 0.99),
        };

        return {
          ...current,
          vitals: {
            ...current.vitals,
            heartRate: hr,
            respiratoryRate: rr,
            spo2,
            apneaProbability,
            signalQuality,
            confidence,
          },
          ecgWaveform: [
            ...current.ecgWaveform.slice(-71),
            { time: nowLabel(), value: nextPoint(79, 17, 220, simIndexRef.current) },
          ],
          respiratoryTrend: [...current.respiratoryTrend.slice(-39), { time: nowLabel(), value: rr }],
          spo2Trend: [...current.spo2Trend.slice(-39), { time: nowLabel(), value: spo2 }],
          apneaRiskTrend: [
            ...current.apneaRiskTrend.slice(-39),
            { time: nowLabel(), value: apneaProbability },
          ],
          multiHorizonRisk: [...current.multiHorizonRisk.slice(-29), horizonRisk],
          predictions: [nextPrediction, ...current.predictions].slice(0, 14),
          eventSummary: {
            ...current.eventSummary,
            currentStatus: aopSignal ? "AOP Detected" : riskLevel === "Low" ? "Recovery" : "Monitoring",
            aopLastHour: nextAopLastHour,
            aopLast24h: nextAopLast24h,
          },
        };
      });
    }, 1300);

    return () => window.clearInterval(timer);
  }, []);

  const selectedPatient = patient;
  const patientOptions = useMemo(() => nicuPatients.slice(0, 10), []);
  const currentRisk = asRisk(selectedPatient.vitals.apneaProbability);
  const patientOptionRiskById = useMemo(
    () =>
      new Map(
        patientOptions.map((entry) => {
          const risk = asRisk(entry.vitals.apneaProbability);
          return [entry.id, risk] as const;
        }),
      ),
    [patientOptions],
  );
  const horizonLabel = `${selectedPatient.vitals.predictionHorizon}s`;
  const topRecommendation = clinicalRecommendations[currentRisk][0];
  const selectedTracker = aopTrackerRef.current[selectedPatient.id];
  const recentAopEvents1h = selectedTracker
    ? selectedTracker.timestamps.filter((ts) => (selectedTracker.elapsedSec - ts) <= 3600).length
    : selectedPatient.eventSummary.aopLastHour;
  const recentAopEvents12h = selectedTracker
    ? selectedTracker.timestamps.filter((ts) => (selectedTracker.elapsedSec - ts) <= 43200).length
    : selectedPatient.eventSummary.aopLast24h;
  const selectedPbEvents24h = selectedPatient.eventSummary.periodicBreathingEpisodes;

  // Announce only critical transitions to screen readers (avoid noisy live updates).
  useEffect(() => {
    if (currentRisk === "High" && lastAnnouncedRiskRef.current !== "High") {
      setCriticalAnnouncement(
        `Critical apnea risk for ${selectedPatient.name}, ${Math.round(
          selectedPatient.vitals.apneaProbability * 100,
        )} percent. Immediate bedside assessment recommended.`,
      );
    } else if (currentRisk !== "High" && lastAnnouncedRiskRef.current === "High") {
      setCriticalAnnouncement(`Risk reduced to ${currentRisk} for ${selectedPatient.name}.`);
    }
    lastAnnouncedRiskRef.current = currentRisk;
  }, [currentRisk, selectedPatient.name, selectedPatient.vitals.apneaProbability]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (!medicalActionsRef.current?.contains(event.target as Node)) {
        setIsMedicalActionsOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
        setIsMedicalActionsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const criticalEvents = selectedPatient.predictions
    .filter((row) => row.riskLevel !== "Low")
    .slice(0, 8)
    .map((row) => ({ ...row, eventType: row.riskLevel === "High" ? "AOP risk spike" : "Observation alert" }));
  const recentRows =
    criticalEvents.length > 0
      ? criticalEvents
      : selectedPatient.predictions
          .slice(0, 5)
          .map((row) => ({ ...row, eventType: "Monitoring update" }));
  const groupedRecentRows = useMemo(() => {
    const grouped = [];
    for (const row of recentRows) {
      const last = grouped[grouped.length - 1];
      if (
        last &&
        last.riskLevel === row.riskLevel &&
        last.eventType === row.eventType &&
        last.recommendation === row.recommendation
      ) {
        last.count += 1;
        continue;
      }
      grouped.push({ ...row, count: 1 });
    }
    return grouped;
  }, [recentRows]);

  const horizonTrendData = selectedPatient.multiHorizonRisk.slice(-30).map((point, index, arr) => {
    const secondsAgo = -(arr.length - 1 - index) * 4;
    const avg = (point.risk30 + point.risk60 + point.risk120) / 3;
    return {
      secondsAgo,
      riskAvg: Math.round(avg * 100),
    };
  });

  const riskPercent = Math.round(selectedPatient.vitals.apneaProbability * 100);
  const ageLabel = `${selectedPatient.dayOfLife} days`;
  const RiskIcon = riskIcon[currentRisk];
  const notificationsCount = groupedRecentRows.length;
  const handlePrintMedicalPdf = () => {
    const previousTitle = document.title;
    document.title = `NeoSense Medical Report - ${selectedPatient.name} (${selectedPatient.mrn}) - ${new Date().toLocaleString()}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 100);
    setIsMedicalActionsOpen(false);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      aria-labelledby="page-title"
      className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#dff2ff_0%,transparent_30%),radial-gradient(circle_at_95%_5%,#dbeafe_0%,transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f4f8fc_45%,#edf3fa_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-5 lg:px-8"
    >
      {/* Polite live region for status changes (Live/Paused, etc.) */}
      <p role="status" aria-live="polite" className="sr-only">
        Selected patient {selectedPatient.name}, current risk {currentRisk}, {riskPercent} percent.
      </p>
      {/* Assertive live region for critical clinical transitions only */}
      <p role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {criticalAnnouncement}
      </p>

      <div className="mx-auto max-w-[1760px] space-y-3 sm:space-y-4">
        <header
          className="rounded-3xl border border-slate-200/90 bg-white/95 px-3.5 py-3.5 shadow-[0_10px_34px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:px-5 sm:py-4"
          aria-label="Dashboard summary"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
              <img src={logo} alt="NeoSense AI" className="h-14 w-auto object-contain sm:h-20" />
              <div>
                <h1 id="page-title" className="text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                  NICU Predictive Monitoring
                </h1>
                <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-600 sm:text-xs">
                  Hospital-integrated neonatal intelligence platform for continuous clinical care
                </p>
              </div>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                <div className="relative" ref={medicalActionsRef}>
                  <button
                    type="button"
                    onClick={() => setIsMedicalActionsOpen((open) => !open)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-gradient-to-b from-brand-50 to-sky-50 px-3 py-2 text-xs font-semibold text-brand-900 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 sm:w-auto sm:py-1.5"
                    aria-haspopup="menu"
                    aria-expanded={isMedicalActionsOpen}
                    aria-label="Open medical actions"
                  >
                    <FileText className="h-4 w-4 text-brand-800" aria-hidden="true" />
                    Medical Actions
                  </button>
                  {isMedicalActionsOpen ? (
                    <div
                      role="menu"
                      aria-label="Medical actions"
                      className="absolute left-0 z-20 mt-2 w-full min-w-[220px] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-[0_16px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:left-auto sm:right-0 sm:w-60"
                    >
                      <button
                        type="button"
                        onClick={handlePrintMedicalPdf}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                        role="menuitem"
                      >
                        <Printer className="h-4 w-4 text-brand-700" aria-hidden="true" />
                        Print as Medical PDF
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="relative" ref={notificationsRef}>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsOpen((open) => !open)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2 sm:w-auto sm:py-1.5"
                    aria-haspopup="dialog"
                    aria-expanded={isNotificationsOpen}
                    aria-label="Open notifications"
                  >
                    <BellRing className="h-4 w-4 text-amber-700" aria-hidden="true" />
                    Notifications
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {notificationsCount}
                    </span>
                  </button>
                  {isNotificationsOpen ? (
                    <div
                      role="dialog"
                      aria-label="Clinical notifications"
                      className="absolute left-0 z-20 mt-2 w-[min(92vw,430px)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_36px_rgba(15,23,42,0.16)] backdrop-blur-sm sm:left-auto sm:right-0 sm:w-[min(94vw,430px)]"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-900">
                          <BellRing className="h-4 w-4 text-amber-700" aria-hidden="true" />
                          Clinical Event Feed
                        </h3>
                        <p className="text-xs text-slate-700">Severity-coded timeline alerts</p>
                      </div>
                      <ol className="max-h-[340px] space-y-2 overflow-y-auto pe-1" aria-label="Recent clinical events">
                        {groupedRecentRows.map((row) => {
                          const RowIcon = riskIcon[row.riskLevel];
                          return (
                            <li
                              key={row.id}
                              className="relative rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50 p-3 ps-4"
                            >
                              <span
                                aria-hidden="true"
                                className={`absolute start-0 top-0 h-full w-1 rounded-s-2xl ${
                                  row.riskLevel === "High"
                                    ? "bg-rose-500"
                                    : row.riskLevel === "Moderate"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                              />
                              <div className="flex items-center justify-between gap-2">
                                <time className="text-xs text-slate-700">{row.time}</time>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${riskBadgeClass[row.riskLevel]}`}
                                >
                                  <RowIcon className="h-3 w-3" aria-hidden="true" />
                                  {row.riskLevel}
                                </span>
                              </div>
                              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
                                <RowIcon
                                  className={`h-3.5 w-3.5 ${
                                    row.riskLevel === "High"
                                      ? "text-rose-600"
                                      : row.riskLevel === "Moderate"
                                        ? "text-amber-700"
                                        : "text-emerald-700"
                                  }`}
                                  aria-hidden="true"
                                />
                                {row.eventType}
                                {row.count > 1 ? (
                                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    x{row.count}
                                  </span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-sm text-slate-800">{row.recommendation}</p>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ) : null}
                </div>
              </div>
              <dl
                className="grid grid-cols-1 gap-1.5 text-[11px] text-slate-900 sm:grid-cols-3 lg:grid-cols-6"
                aria-label="Patient summary"
              >
                <div className={summaryTileClass}>
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <User className="h-3 w-3" aria-hidden="true" />
                  Patient
                </dt>
                <dd>
                  <label htmlFor="patient-selector" className="sr-only">
                    Select patient
                  </label>
                  <select
                    id="patient-selector"
                    value={selectedPatient.id}
                    onChange={(event) => {
                      const next = patientOptions.find((entry) => entry.id === event.target.value);
                      if (next) setPatient(next);
                    }}
                    className={`mt-1 w-full rounded-lg border px-2 py-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${patientStatusSelectClass[currentRisk]}`}
                    aria-label="Patient"
                  >
                    {patientOptions.map((entry) => (
                      <option
                        key={entry.id}
                        value={entry.id}
                        style={{
                          color:
                            patientOptionRiskById.get(entry.id) === "High"
                              ? "#be123c"
                              : patientOptionRiskById.get(entry.id) === "Moderate"
                                ? "#92400e"
                                : "#065f46",
                          backgroundColor:
                            patientOptionRiskById.get(entry.id) === "High"
                              ? "#ffe4e6"
                              : patientOptionRiskById.get(entry.id) === "Moderate"
                                ? "#fffbeb"
                                : "#ecfdf5",
                          fontWeight: 600,
                        }}
                      >
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </dd>
              </div>
              <div className={summaryTileClass}>
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <Hash className="h-3 w-3" aria-hidden="true" />
                  Bed Number
                </dt>
                <dd className="text-[11px] font-semibold">{selectedPatient.bed}</dd>
              </div>
              <div className={summaryTileClass}>
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <Hash className="h-3 w-3" aria-hidden="true" />
                  MRN
                </dt>
                <dd className="text-[11px] font-semibold">{selectedPatient.mrn}</dd>
              </div>
              <div className={summaryTileClass}>
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  Gestational age
                </dt>
                <dd className="text-[11px] font-semibold">{selectedPatient.gestationalAgeWeeks} weeks</dd>
              </div>
              <div className={summaryTileClass}>
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  Birth weight
                </dt>
                <dd className="text-[11px] font-semibold">{selectedPatient.birthWeightGrams} g</dd>
              </div>
                <div className="rounded-lg border border-brand-200 bg-gradient-to-b from-brand-50/70 to-sky-50/70 px-2 py-1.5 transition-colors hover:border-brand-300 sm:px-3">
                <dt className="inline-flex items-center gap-1 text-[10px] text-slate-700">
                  <User className="h-3 w-3" aria-hidden="true" />
                  Sex / age
                </dt>
                <dd className="text-[11px] font-semibold">
                  {selectedPatient.sex} - {ageLabel}
                </dd>
              </div>
              </dl>
            </div>
          </div>
        </header>

        <div>
          <section aria-label="Live monitoring" className="grid gap-3.5">
            <div className="space-y-3.5">
              <article className={panelClass} aria-labelledby="risk-overview-title">
                <h2 id="risk-overview-title" className="sr-only">
                  Risk overview
                </h2>
                <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-100/70 p-2.5 sm:p-3.5">
                  <div className="grid gap-3.5 lg:grid-cols-[minmax(260px,320px)_1fr]">
                    <div
                      className={`relative mx-auto flex w-full max-w-[320px] flex-col items-center justify-between gap-3 overflow-hidden rounded-2xl border border-brand-300/80 bg-gradient-to-br from-brand-50/95 via-white to-sky-50/60 px-4 py-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_20px_rgba(8,145,178,0.1)] sm:px-5 sm:py-4 ${riskPulseClass[currentRisk]}`}
                    >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand-100/60 blur-2xl"
                    />
                    <div className="relative flex flex-col items-center justify-center gap-1">
                      <p className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        <ShieldAlert className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                        Current Risk Level
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBadgeClass[currentRisk]}`}
                      >
                        <RiskIcon className="h-3 w-3" aria-hidden="true" />
                        {currentRisk}
                      </span>
                    </div>
                    <p
                      className={`text-5xl font-bold leading-none tracking-tight sm:text-7xl ${riskAccentClass[currentRisk]}`}
                      aria-label={`${riskPercent} percent`}
                    >
                      {riskPercent}
                      <span aria-hidden="true" className="ms-1 text-4xl font-semibold opacity-80">
                        %
                      </span>
                    </p>
                    <p className="text-xs text-slate-600">
                      {currentRisk} apnea risk in active horizon ({horizonLabel})
                    </p>
                  </div>

                    <div className="space-y-3">
                      <dl className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {[
                          {
                            label: "PB Events (24h)",
                            value: String(selectedPbEvents24h),
                            sub: "last 24 hours",
                            tone: "text-violet-800",
                          },
                          {
                            label: "AOP Rate (1h)",
                            value: `${recentAopEvents1h}/h`,
                            sub: "rolling last hour",
                            tone: "text-amber-800",
                          },
                          {
                            label: "AOP Events (12h)",
                            value: String(recentAopEvents12h),
                            sub: "last 12 hours",
                            tone: "text-amber-800",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-shadow hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                          >
                            <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{item.label}</dt>
                            <dd className={`mt-1 text-lg font-semibold ${item.tone}`}>{item.value}</dd>
                            {item.sub ? (
                              <p className="text-[11px] font-medium text-slate-500">{item.sub}</p>
                            ) : null}
                          </div>
                        ))}
                      </dl>
                      <div>
                        <p className="mb-1.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          <GaugeCircle className="h-3 w-3 text-violet-700" aria-hidden="true" />
                          Forecast &amp; Quality
                        </p>
                        <dl className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                          {[
                            {
                              label: "Recommendation",
                              value: topRecommendation,
                              icon: Lightbulb,
                              cls: "text-slate-900",
                              iconCls: "text-amber-500",
                            },
                            {
                              label: "Signal quality",
                              value: `${Math.round(selectedPatient.vitals.signalQuality * 100)}%`,
                              icon: Signal,
                              cls: "text-emerald-800",
                              iconCls: "text-emerald-600",
                            },
                          ].map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <div
                                key={item.label}
                                className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all hover:border-violet-200 hover:shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                              >
                                <dt className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                                  <ItemIcon className={`h-3 w-3 ${item.iconCls}`} aria-hidden="true" />
                                  {item.label}
                                </dt>
                                <dd
                                  className={`mt-1 line-clamp-2 text-[15px] font-semibold leading-snug ${item.cls}`}
                                >
                                  {item.value}
                                </dd>
                              </div>
                            );
                          })}
                          <VitalsSummary
                            heartRate={selectedPatient.vitals.heartRate}
                            respiratoryRate={selectedPatient.vitals.respiratoryRate}
                            spo2={selectedPatient.vitals.spo2}
                          />
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3.5 rounded-2xl border border-slate-200/90 bg-white/90 p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3
                        id="chart-title"
                        className="inline-flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-900"
                      >
                        <GaugeCircle className="h-4 w-4 text-brand-700" aria-hidden="true" />
                        Apnea Risk Trend - Mean Clinical Risk (%)
                      </h3>
                    </div>
                    <figure
                      className="h-[240px] rounded-2xl border border-slate-200/80 bg-transparent p-2 sm:h-[320px] sm:p-3"
                      aria-labelledby="chart-title"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={horizonTrendData}>
                          <CartesianGrid strokeDasharray="2 4" stroke="rgba(100,116,139,0.2)" />
                          <ReferenceLine y={30} stroke="#d97706" strokeDasharray="4 4" />
                          <ReferenceLine y={70} stroke="#be123c" strokeDasharray="4 4" />
                          <XAxis
                            dataKey="secondsAgo"
                            tick={{ fill: "#334155", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => (value === 0 ? "Now" : `${Math.abs(value)}s`)}
                          />
                          <YAxis
                            tick={{ fill: "#334155", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 100]}
                            ticks={[0, 20, 40, 60, 80, 100]}
                            label={{
                              value: "Probability (%)",
                              angle: -90,
                              position: "insideLeft",
                              style: { fill: "#334155", fontSize: 11 },
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#ffffff",
                              border: "1px solid #94a3b8",
                              borderRadius: 12,
                              color: "#0f172a",
                            }}
                            labelFormatter={(label) => (label === 0 ? "Now" : `${Math.abs(Number(label))}s ago`)}
                            formatter={(value, name) => [`${value}%`, String(name)]}
                          />
                          <Legend
                            verticalAlign="bottom"
                            height={30}
                            wrapperStyle={{ fontSize: "12px", color: "#475569" }}
                          />
                          <Line
                            type="linear"
                            dataKey="riskAvg"
                            name="Mean clinical risk"
                            stroke="#be123c"
                            strokeWidth={2.6}
                            dot={false}
                            isAnimationActive={false}
                            activeDot={{ r: 5, strokeWidth: 1, stroke: "#fff" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </figure>
                  </div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
