from __future__ import annotations

import hashlib
import pickle
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, Dict, List

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

from .physionet_loader import (
  FEATURE_COLUMNS,
  PhysioSample,
  build_training_frame,
  load_physionet_samples,
)

CACHE_DIR_NAME = ".neosense_cache"


@dataclass
class VitalSample:
  hr: float
  spo2: float
  rr: float


class NeoSenseEngine:
  """Prototype clinical decision engine for NICU monitoring of preterm infants.

  Trained on the PhysioNet PICS database (Preterm Infant Cardio-Respiratory
  Signals). Bradycardia onset annotations drive the predictive label, while
  AOP/PB are derived live from the rolling vital sign window. SpO2 is simulated
  because PICS lacks pulse oximetry; consumers should display this fact.
  """

  BRADY_HR_THRESHOLD = 100.0
  BRADY_MIN_DURATION_SEC = 2
  AOP_MIN_APNEA_DURATION_SEC = 20
  AOP_COOLDOWN_SEC = 20 * 60
  AOP_MAX_PER_HOUR = 3
  DEMO_SEQUENCE = [
    ("Stable", 180),
    ("Mild deterioration", 90),
    ("Moderate deterioration", 90),
    ("Pre-apnea", 60),
    ("Active event", 30),
    ("Recovery", 180),
  ]

  @staticmethod
  def _normalize_record_name(record: str) -> str:
    return record.replace("_ecg", "").replace("_resp", "")

  @classmethod
  def _unique_training_records(cls, records: List[str], active_record: str) -> List[str]:
    """Normalize, deduplicate, and exclude the active playback record."""
    active = cls._normalize_record_name(active_record)
    seen = set()
    cleaned: List[str] = []
    for record in records:
      normalized = cls._normalize_record_name(record)
      if normalized == active or normalized in seen:
        continue
      seen.add(normalized)
      cleaned.append(normalized)
    if not cleaned:
      raise ValueError("Training records must contain at least one infant different from active record.")
    return cleaned

  def __init__(
    self,
    patient_id: str,
    room_id: str,
    baseline_spo2: float = 96.0,
    dataset_dir: str | None = None,
    record: str = "infant1",
    training_records: List[str] | None = None,
    demo_mode: bool = True,
  ) -> None:
    self.patient_id = patient_id
    self.room_id = room_id
    self.baseline_spo2 = baseline_spo2
    self.window: Deque[VitalSample] = deque(maxlen=120)
    self._rng = np.random.default_rng(seed=42)
    self.record = self._normalize_record_name(record)
    self.demo_mode = demo_mode
    requested_training_records = training_records or [
      "infant1",
      "infant2",
      "infant3",
      "infant4",
      "infant5",
      "infant6",
      "infant7",
      "infant8",
    ]
    self.training_records = self._unique_training_records(requested_training_records, self.record)
    backend_dir = Path(__file__).resolve().parents[2]
    self.dataset_dir = Path(dataset_dir) if dataset_dir else (backend_dir / "picsdb")

    cache_path = self._model_cache_path()
    if cache_path.exists():
      self.dataset_samples = load_physionet_samples(self.dataset_dir, self.record)
      self.training_samples: List[PhysioSample] = []
    else:
      self.dataset_samples, self.training_samples = self._load_records_parallel()
    self.model = self._load_or_train_model()
    self._sample_cursor = 0
    self._elapsed_seconds = 0
    self._daily_event_count = 0
    self._last_event_ts: int | None = None
    self._probability_ema = 0.15
    self._active_event_name: str | None = None
    self._aop_event_timestamps: Deque[int] = deque()
    self._all_event_timestamps: Deque[int] = deque()
    self._last_aop_event_ts: int | None = None
    self._current_hr: float | None = None
    self._current_spo2: float | None = None
    self._current_rr: float | None = None
    self._prime_from_dataset()

  def _prime_from_dataset(self) -> None:
    initial = self.dataset_samples[:120]
    if len(initial) < 120:
      raise ValueError("PICS dataset did not provide enough samples to initialize.")
    for row in initial:
      self.window.append(VitalSample(hr=row.hr, spo2=row.spo2, rr=row.rr))
    self._sample_cursor = 120

  def _load_records_parallel(self) -> tuple[List[PhysioSample], List[PhysioSample]]:
    """Concurrently load the playback infant + every training infant.

    Loading is I/O + CPU bound (wfdb decode + numpy ops); a small thread pool
    overlaps these costs without GIL contention during numpy work.
    """
    records_to_load = [self.record, *self.training_records]

    def _load(record: str) -> List[PhysioSample]:
      return load_physionet_samples(self.dataset_dir, record)

    with ThreadPoolExecutor(max_workers=min(4, len(records_to_load))) as pool:
      results = list(pool.map(_load, records_to_load))

    dataset_samples = results[0]
    training_samples: List[PhysioSample] = []
    for chunk in results[1:]:
      training_samples.extend(chunk)
    return dataset_samples, training_samples

  def _model_cache_path(self) -> Path:
    digest = hashlib.sha1(
      f"{sorted(self.training_records)}|{self.record}|rf-200-balanced-w120".encode(),
    ).hexdigest()[:16]
    return self.dataset_dir / CACHE_DIR_NAME / f"model-{digest}.pkl"

  def _load_or_train_model(self) -> RandomForestClassifier:
    cache_path = self._model_cache_path()
    if cache_path.exists():
      try:
        with cache_path.open("rb") as fh:
          return pickle.load(fh)
      except Exception:
        cache_path.unlink(missing_ok=True)

    model = self._train_physionet_model()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with cache_path.open("wb") as fh:
      pickle.dump(model, fh)
    return model

  def _train_physionet_model(self) -> RandomForestClassifier:
    frame, labels = build_training_frame(self.training_samples, window_size=120)
    if len(np.unique(labels)) < 2:
      raise ValueError(
        "Training labels for this infant lack class diversity. Choose another infant record.",
      )
    x_train, _, y_train, _ = train_test_split(
      frame.values, labels, test_size=0.2, random_state=42, stratify=labels,
    )
    clf = RandomForestClassifier(
      n_estimators=200, random_state=42, class_weight="balanced", n_jobs=-1,
    )
    clf.fit(x_train, y_train)
    return clf

  def _feature_frame(self) -> pd.DataFrame:
    arr_hr = np.array([s.hr for s in self.window], dtype=float)
    arr_spo2 = np.array([s.spo2 for s in self.window], dtype=float)
    arr_rr = np.array([s.rr for s in self.window], dtype=float)
    rr_low_ratio = float(np.mean(arr_rr < 5))
    return pd.DataFrame(
      [[arr_hr.mean(), arr_spo2.mean(), arr_rr.mean(), arr_hr.std(), arr_spo2.std(), rr_low_ratio]],
      columns=FEATURE_COLUMNS,
    )

  def _demo_timeline(self) -> tuple[str, float]:
    """Return active demo phase and intra-phase progress [0..1]."""
    if not self.demo_mode:
      return "Stable", 0.0
    total = sum(duration for _, duration in self.DEMO_SEQUENCE)
    position = self._elapsed_seconds % total
    cursor = 0
    for phase, duration in self.DEMO_SEQUENCE:
      if position < cursor + duration:
        progress = (position - cursor) / max(duration, 1)
        return phase, float(np.clip(progress, 0.0, 1.0))
      cursor += duration
    return "Stable", 0.0

  @staticmethod
  def _approach(current: float, target: float, max_step: float) -> float:
    delta = target - current
    if abs(delta) <= max_step:
      return target
    return current + np.sign(delta) * max_step

  def _state_targets(self, phase: str, phase_progress: float, base_hr: float, base_spo2: float, base_rr: float) -> tuple[float, float, float]:
    """Map phase to physiologically plausible targets."""
    baseline_rr = max(base_rr, 36.0)
    baseline_hr = max(base_hr, 130.0)
    baseline_spo2 = max(base_spo2, 95.0)
    if phase == "Stable":
      return baseline_hr, baseline_spo2, baseline_rr
    if phase == "Mild deterioration":
      return baseline_hr - 4.0, baseline_spo2 - 1.0, max(baseline_rr - 8.0, 26.0)
    if phase == "Moderate deterioration":
      return baseline_hr - 10.0, baseline_spo2 - 3.0, max(baseline_rr - 16.0, 14.0)
    if phase == "Pre-apnea":
      return baseline_hr - 18.0, baseline_spo2 - 5.0, 8.0
    if phase == "Active event":
      nadir_rr = 0.5 if phase_progress > 0.35 else 4.0
      nadir_spo2 = baseline_spo2 - 11.0
      nadir_hr = max(baseline_hr - 34.0, 95.0)
      return nadir_hr, nadir_spo2, nadir_rr
    # Recovery: gradual normalization, not immediate reset
    rebound = float(np.clip(phase_progress, 0.0, 1.0))
    target_hr = (baseline_hr - 14.0) + 14.0 * rebound
    target_spo2 = (baseline_spo2 - 6.0) + 6.0 * rebound
    target_rr = 10.0 + (baseline_rr - 10.0) * rebound
    return target_hr, target_spo2, target_rr

  def _simulate_vitals(self, sample: PhysioSample) -> VitalSample:
    phase, phase_progress = self._demo_timeline()
    base_hr = float(sample.hr)
    base_spo2 = float(sample.spo2)
    base_rr = float(sample.rr)
    target_hr, target_spo2, target_rr = self._state_targets(phase, phase_progress, base_hr, base_spo2, base_rr)
    if self._current_hr is None:
      # Start from clinically plausible targets to avoid unrealistic initial jumps.
      self._current_hr = target_hr
      self._current_spo2 = target_spo2
      self._current_rr = target_rr
    assert self._current_spo2 is not None and self._current_rr is not None
    self._current_hr = self._approach(self._current_hr, target_hr, max_step=1.2)
    self._current_spo2 = self._approach(self._current_spo2, target_spo2, max_step=0.25)
    self._current_rr = self._approach(self._current_rr, target_rr, max_step=0.9)
    # Small bounded variability to avoid a frozen look while preserving smooth trends.
    hr = float(self._current_hr + self._rng.normal(0.0, 0.5))
    spo2 = float(self._current_spo2 + self._rng.normal(0.0, 0.12))
    rr = float(self._current_rr + self._rng.normal(0.0, 0.4))
    hr = float(np.clip(hr, 75.0, 190.0))
    spo2 = float(np.clip(spo2, 75.0, 100.0))
    rr = float(np.clip(rr, 0.0, 75.0))
    return VitalSample(hr=hr, spo2=spo2, rr=rr)

  def _detect_bradycardia(self) -> bool:
    """Bradycardia: HR < 100 bpm for >= 1.2s (>= 2 consecutive seconds in our 1Hz feed)."""
    arr_hr = np.array([s.hr for s in self.window], dtype=float)
    run = 0
    for hr in arr_hr[-10:]:
      if hr < self.BRADY_HR_THRESHOLD:
        run += 1
        if run >= self.BRADY_MIN_DURATION_SEC:
          return True
      else:
        run = 0
    return False

  def _detect_aop(self) -> bool:
    """Apnea of Prematurity with stricter onset logic.

    Requires an ONGOING apnea run in the most recent samples (not only historic
    run inside the 120s window) plus clinically meaningful SpO2 drop.
    """
    arr_rr = np.array([s.rr for s in self.window], dtype=float)
    arr_spo2 = np.array([s.spo2 for s in self.window], dtype=float)
    current_run = 0
    for rr in arr_rr[::-1]:
      if rr < 5:
        current_run += 1
      else:
        break
    if current_run < self.AOP_MIN_APNEA_DURATION_SEC:
      return False
    # Baseline comes from the earlier stable segment, not from the active dip.
    baseline_window = arr_spo2[:60] if len(arr_spo2) >= 60 else arr_spo2
    baseline = float(np.median(baseline_window)) if len(baseline_window) else self.baseline_spo2
    spo2_drop = baseline - float(np.min(arr_spo2[-45:]))
    return spo2_drop >= 5.0

  def _aop_allowed(self) -> bool:
    """Limit AOP episodes to clinically plausible hourly burden."""
    if self._aop_in_window(3600) >= self.AOP_MAX_PER_HOUR:
      return False
    if self._last_aop_event_ts is None:
      return True
    return (self._elapsed_seconds - self._last_aop_event_ts) >= self.AOP_COOLDOWN_SEC

  def _detect_pb(self) -> bool:
    """Periodic Breathing pattern: >= 3 short pauses (5-10s) with stable SpO2/HR variance."""
    arr_rr = np.array([s.rr for s in self.window], dtype=float)
    arr_spo2 = np.array([s.spo2 for s in self.window], dtype=float)
    arr_hr = np.array([s.hr for s in self.window], dtype=float)

    pauses = []
    current_pause = 0
    for rr in arr_rr:
      if rr < 5:
        current_pause += 1
      elif current_pause:
        pauses.append(current_pause)
        current_pause = 0
    if current_pause:
      pauses.append(current_pause)

    qualifying_pauses = sum(1 for p in pauses if 5 <= p <= 10)
    stable_hr = float(np.std(arr_hr[-60:])) <= 6
    stable_spo2 = float(np.std(arr_spo2[-60:])) <= 2
    return qualifying_pauses >= 3 and stable_spo2 and stable_hr

  @staticmethod
  def classify_spo2(spo2: float) -> str:
    if spo2 < 90:
      return "Desaturation"
    if spo2 <= 95:
      return "Normoxemia"
    return "Hyperoxia"

  @staticmethod
  def classify_risk(probability: float) -> str:
    if probability < 0.30:
      return "Low"
    if probability <= 0.70:
      return "Moderate"
    return "High"

  @staticmethod
  def classify_patient_state(risk: str, event: str, phase: str) -> str:
    if event in ("AOP", "Bradycardia"):
      return "Active event"
    if phase == "Recovery":
      return "Recovery"
    if phase == "Pre-apnea":
      return "Pre-apnea"
    if phase == "Moderate deterioration" or risk == "High":
      return "Moderate deterioration"
    if phase == "Mild deterioration" or risk == "Moderate":
      return "Mild deterioration"
    return "Stable"

  @staticmethod
  def prediction_window_seconds(probability: float) -> int:
    if probability >= 0.85:
      return 30
    if probability >= 0.65:
      return 45
    if probability >= 0.45:
      return 60
    if probability >= 0.30:
      return 90
    return 120

  @staticmethod
  def recommendation(event: str, risk: str) -> str:
    if event in ("AOP", "Bradycardia"):
      return "EMERGENCY"
    if risk == "High":
      return "URGENT"
    if risk == "Moderate":
      return "CAUTION"
    if event == "PB" and risk == "Low":
      return "INFORMATIONAL"
    return "ROUTINE"

  @staticmethod
  def interventions(patient_state: str, event: str, spo2: float, rr: float, hr: float) -> List[str]:
    if patient_state not in ("Active event", "Pre-apnea"):
      return ["Continue close monitoring and reassess trends every 2 minutes."]
    actions = [
      "Check airway patency and infant positioning immediately.",
      "Escalate bedside assessment to senior NICU clinician.",
    ]
    if event == "Bradycardia" or hr < 100:
      actions.append("Tactile stimulation and reassess HR within 30 seconds.")
      actions.append("Verify ECG lead contact and review caffeine therapy timing.")
    if spo2 < 90:
      actions.append("Assess oxygen delivery setup and consider gentle stimulation per protocol.")
    if rr < 5:
      actions.append("Prepare for supported ventilation per unit protocol if apnea persists.")
    if event == "AOP":
      actions.append("Review caffeine therapy timing and recent apnea burden.")
    return actions

  def _classify_event(self) -> str:
    if self._detect_aop() and self._aop_allowed():
      return "AOP"
    if self._detect_bradycardia():
      return "Bradycardia"
    if self._detect_pb():
      return "PB"
    return "None"

  def _physiology_risk_score(self) -> float:
    arr_hr = np.array([s.hr for s in self.window], dtype=float)
    arr_spo2 = np.array([s.spo2 for s in self.window], dtype=float)
    arr_rr = np.array([s.rr for s in self.window], dtype=float)
    recent = slice(-15, None)
    previous = slice(-30, -15)
    rr_now = float(np.mean(arr_rr[recent]))
    spo2_now = float(np.mean(arr_spo2[recent]))
    hr_now = float(np.mean(arr_hr[recent]))
    rr_trend = float(np.mean(arr_rr[recent]) - np.mean(arr_rr[previous]))
    spo2_trend = float(np.mean(arr_spo2[recent]) - np.mean(arr_spo2[previous]))
    hr_trend = float(np.mean(arr_hr[recent]) - np.mean(arr_hr[previous]))
    rr_score = np.clip((40.0 - rr_now) / 40.0, 0.0, 1.0)
    spo2_score = np.clip((96.0 - spo2_now) / 12.0, 0.0, 1.0)
    hr_score = np.clip((140.0 - hr_now) / 45.0, 0.0, 1.0)
    trend_rr_score = np.clip((-rr_trend) / 8.0, 0.0, 1.0)
    trend_spo2_score = np.clip((-spo2_trend) / 2.0, 0.0, 1.0)
    trend_hr_score = np.clip((-hr_trend) / 6.0, 0.0, 1.0)
    return float(
      0.35 * rr_score
      + 0.20 * spo2_score
      + 0.10 * hr_score
      + 0.20 * trend_rr_score
      + 0.10 * trend_spo2_score
      + 0.05 * trend_hr_score
    )

  def _target_probability(self, model_probability: float, phase: str, phase_progress: float) -> float:
    phys_score = self._physiology_risk_score()
    combined = float(np.clip(0.40 * model_probability + 0.60 * phys_score, 0.01, 0.99))
    # Keep phase-consistent probability bands for believable demo progression.
    if phase == "Stable":
      return float(np.clip(combined, 0.10, 0.25))
    if phase == "Mild deterioration":
      return float(np.clip(combined, 0.30, 0.50))
    if phase == "Moderate deterioration":
      return float(np.clip(combined, 0.45, 0.70))
    if phase == "Pre-apnea":
      return float(np.clip(combined, 0.60, 0.85))
    if phase == "Active event":
      return float(np.clip(max(combined, 0.90), 0.90, 0.99))
    # Recovery should decline slowly over time rather than immediate normalization.
    upper = 0.80 - 0.55 * float(np.clip(phase_progress, 0.0, 1.0))
    lower = 0.35 - 0.20 * float(np.clip(phase_progress, 0.0, 1.0))
    return float(np.clip(combined, lower, upper))

  def _smooth_probability(self, target: float) -> float:
    # Rising risk can move faster; recovery intentionally decays slower.
    alpha = 0.11 if target > self._probability_ema else 0.04
    self._probability_ema = float(np.clip(self._probability_ema + alpha * (target - self._probability_ema), 0.01, 0.99))
    return self._probability_ema

  def _register_event_episode(self, event: str) -> bool:
    """Count events only on episode start, not every second."""
    if event == "None":
      self._active_event_name = None
      return False
    if self._active_event_name == event:
      return False
    self._active_event_name = event
    self._daily_event_count += 1
    self._last_event_ts = self._elapsed_seconds
    self._all_event_timestamps.append(self._elapsed_seconds)
    if event == "AOP":
      self._last_aop_event_ts = self._elapsed_seconds
      self._aop_event_timestamps.append(self._elapsed_seconds)
    return True

  def _prune_event_logs(self) -> None:
    while self._aop_event_timestamps and (self._elapsed_seconds - self._aop_event_timestamps[0]) > 86400:
      self._aop_event_timestamps.popleft()
    while self._all_event_timestamps and (self._elapsed_seconds - self._all_event_timestamps[0]) > 86400:
      self._all_event_timestamps.popleft()

  def _aop_in_window(self, seconds: int) -> int:
    return int(sum(1 for ts in self._aop_event_timestamps if (self._elapsed_seconds - ts) <= seconds))

  def update(self, hr: float, spo2: float, rr: float) -> Dict[str, object]:
    self.window.append(VitalSample(hr=hr, spo2=spo2, rr=rr))
    self._elapsed_seconds += 1
    features = self._feature_frame()
    model_probability = float(np.clip(self.model.predict_proba(features.values)[0][1], 0.01, 0.99))
    phase, phase_progress = self._demo_timeline()
    probability = self._smooth_probability(self._target_probability(model_probability, phase, phase_progress))
    event = self._classify_event()
    self._register_event_episode(event)
    self._prune_event_logs()
    risk = self.classify_risk(probability)
    patient_state = self.classify_patient_state(risk, event, phase)
    prediction_window_sec = self.prediction_window_seconds(probability)
    recommendation = self.recommendation(event, risk)
    interventions = self.interventions(patient_state, event, spo2, rr, hr)
    aop_last_hour = self._aop_in_window(3600)
    aop_last_24h = self._aop_in_window(86400)

    return {
      "patient_id": self.patient_id,
      "room_id": self.room_id,
      "hr": int(round(hr)),
      "spo2": round(float(spo2), 1),
      "spo2_simulated": True,
      "rr": int(round(rr)),
      "probability": round(probability, 2),
      "prediction_window_sec": prediction_window_sec,
      "risk": risk,
      "patient_state": patient_state,
      "progression_state": phase,
      "event": event,
      "daily_event_count": self._daily_event_count,
      "last_event_ts": self._last_event_ts,
      "aop_events_last_hour": aop_last_hour,
      "aop_events_last_24h": aop_last_24h,
      "spo2_classification": self.classify_spo2(spo2),
      "recommendation": recommendation,
      "interventions": interventions,
      "data_source": "PICS (PhysioNet picsdb 1.0.0)",
    }

  def next_from_dataset(self) -> Dict[str, object]:
    if self._sample_cursor >= len(self.dataset_samples):
      raise StopIteration("Reached end of dataset samples; no repetition allowed.")
    sample = self.dataset_samples[self._sample_cursor]
    self._sample_cursor += 1
    simulated = self._simulate_vitals(sample)
    return self.update(hr=simulated.hr, spo2=simulated.spo2, rr=simulated.rr)
