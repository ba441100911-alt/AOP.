"""
PICS database loader (Preterm Infant Cardio-Respiratory Signals, picsdb v1.0.0).

Per infant we read TWO synchronized records:
  - ``infantN_ecg``  (250 or 500 Hz ECG with ``.qrsc`` R-peaks and ``.atr``
    bradycardia onset annotations)
  - ``infantN_resp`` (50 Hz abdomen inductance band with ``.resp`` peaks)

Output is a per-second sequence of (HR, SpO2, RR, bradycardia_label) suitable
for both predictive modeling and live playback through the NeoSense engine.
SpO2 is *simulated* because PICS does not include pulse oximetry; downstream
code surfaces this fact in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Sequence, Tuple

import numpy as np
import pandas as pd
import wfdb


@dataclass
class PhysioSample:
  hr: float
  spo2: float
  rr: float
  apnea_label: int  # kept name for backward compat; semantically = bradycardia_label


FEATURE_COLUMNS = ["hr_mean", "spo2_mean", "rr_mean", "hr_std", "spo2_std", "rr_low_ratio"]

PREDICTION_HORIZON_SEC = 60
HR_WINDOW_SEC = 8
RR_WINDOW_SEC = 30


def _peaks_per_second(peaks_in_seconds: np.ndarray, total_seconds: int, window_sec: float) -> np.ndarray:
  """Vectorized rolling peak count per second, scaled to events/min.

  Uses ``np.searchsorted`` once on the second-grid edges instead of looping.
  """
  peaks = np.sort(peaks_in_seconds.astype(float))
  ts = np.arange(total_seconds, dtype=float)
  half = window_sec / 2.0
  left = np.searchsorted(peaks, ts - half, side="left")
  right = np.searchsorted(peaks, ts + half, side="right")
  return (right - left).astype(float) * (60.0 / window_sec)


def _hr_from_qrs(qrs_seconds: np.ndarray, total_seconds: int) -> np.ndarray:
  """Per-second HR estimate from manually verified R-peaks.

  Sliding ``HR_WINDOW_SEC`` window centered on each second, converted to bpm.
  Windows with < 2 peaks fall back to 130 bpm (preterm baseline).
  """
  hr = np.full(total_seconds, 130.0, dtype=float)
  if len(qrs_seconds) == 0:
    return hr

  qrs = np.sort(qrs_seconds.astype(float))
  ts = np.arange(total_seconds, dtype=float)
  half = HR_WINDOW_SEC / 2.0
  left = np.searchsorted(qrs, ts - half, side="left")
  right = np.searchsorted(qrs, ts + half, side="right")
  counts = (right - left).astype(float)
  derived = counts * (60.0 / HR_WINDOW_SEC)
  mask = counts >= 2
  hr[mask] = derived[mask]
  return np.clip(hr, 30.0, 220.0)


def _rr_from_resp_peaks(resp_seconds: np.ndarray, total_seconds: int) -> np.ndarray:
  """Per-second respiration rate from automatically detected peaks."""
  if len(resp_seconds) == 0:
    return np.full(total_seconds, 45.0, dtype=float)
  rr = _peaks_per_second(resp_seconds, total_seconds, RR_WINDOW_SEC)
  return np.clip(rr, 0.0, 120.0)


def _bradycardia_labels(brady_seconds: np.ndarray, total_seconds: int) -> np.ndarray:
  """Mark each second within ``PREDICTION_HORIZON_SEC`` BEFORE a bradycardia
  onset as positive. The horizon trains the model to *anticipate* events.
  The onset second itself is also positive.
  """
  labels = np.zeros(total_seconds, dtype=int)
  for onset_sec in brady_seconds:
    onset = int(onset_sec)
    start = max(0, onset - PREDICTION_HORIZON_SEC)
    end = min(total_seconds, onset + 1)
    labels[start:end] = 1
  return labels


def _simulate_spo2(hr: np.ndarray, brady_seconds: np.ndarray, total_seconds: int) -> np.ndarray:
  """Plausible SpO2 trace driven by HR + bradycardia events.

  PICS has no pulse oximetry; this trace is for UI continuity only and is
  surfaced as ``simulated`` in the API.
  """
  rng = np.random.default_rng(seed=2026)
  base = 96.0 + rng.normal(0.0, 0.4, size=total_seconds)
  hr_drag = np.where(hr < 110, (110 - hr) * 0.05, 0.0)
  spo2 = base - hr_drag

  for onset_sec in brady_seconds:
    onset = int(onset_sec)
    start = max(0, onset - 5)
    end = min(total_seconds, onset + 25)
    drop_curve = np.linspace(0.0, 6.0, end - start) if end > start else np.array([])
    if drop_curve.size:
      spo2[start:end] -= drop_curve
  return np.clip(spo2, 78.0, 100.0)


def _load_infant(dataset_dir: Path, infant_id: str) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
  ecg_path = dataset_dir / f"{infant_id}_ecg"
  resp_path = dataset_dir / f"{infant_id}_resp"

  ecg_hdr = wfdb.rdheader(str(ecg_path))
  resp_hdr = wfdb.rdheader(str(resp_path))
  fs_ecg = int(ecg_hdr.fs)
  fs_resp = int(resp_hdr.fs)

  ecg_total_sec = ecg_hdr.sig_len // fs_ecg
  resp_total_sec = resp_hdr.sig_len // fs_resp
  total_seconds = int(min(ecg_total_sec, resp_total_sec))

  qrs_ann = wfdb.rdann(str(ecg_path), "qrsc")
  qrs_seconds = np.asarray(qrs_ann.sample, dtype=float) / float(fs_ecg)

  resp_ann = wfdb.rdann(str(resp_path), "resp")
  resp_peak_seconds = np.asarray(resp_ann.sample, dtype=float) / float(fs_resp)

  brady_ann = wfdb.rdann(str(ecg_path), "atr")
  brady_seconds = np.asarray(brady_ann.sample, dtype=float) / float(fs_ecg)

  hr = _hr_from_qrs(qrs_seconds, total_seconds)
  rr = _rr_from_resp_peaks(resp_peak_seconds, total_seconds)
  spo2 = _simulate_spo2(hr, brady_seconds, total_seconds)
  labels = _bradycardia_labels(brady_seconds, total_seconds)
  return hr, spo2, rr, labels


def load_physionet_samples(dataset_dir: str | Path, record: str) -> List[PhysioSample]:
  """Load a single infant from the PICS database.

  ``record`` accepts either a base id (``"infant1"``) or the explicit ECG
  record name (``"infant1_ecg"``); both forms map to the same infant pair.
  """
  base = Path(dataset_dir)
  infant_id = record.replace("_ecg", "").replace("_resp", "")
  hr, spo2, rr, labels = _load_infant(base, infant_id)
  n = min(len(hr), len(spo2), len(rr), len(labels))
  samples: List[PhysioSample] = []

  for i in range(n):
    samples.append(
      PhysioSample(
        hr=float(hr[i]),
        spo2=float(spo2[i]),
        rr=float(rr[i]),
        apnea_label=int(labels[i]),
      ),
    )

  return samples


def load_physionet_samples_for_records(dataset_dir: str | Path, records: Sequence[str]) -> List[PhysioSample]:
  """Load and concatenate samples from multiple infants for model training."""
  all_samples: List[PhysioSample] = []
  for record in records:
    all_samples.extend(load_physionet_samples(dataset_dir, record))
  return all_samples


def _rolling_mean(values: np.ndarray, window: int) -> np.ndarray:
  """Centered-trailing rolling mean of ``window`` over ``values``.

  Returns an array of length ``len(values) - window`` aligned so that
  ``out[i]`` corresponds to ``values[i:i+window].mean()`` for the window
  ending at index ``i + window - 1``.
  """
  cumsum = np.concatenate(([0.0], np.cumsum(values, dtype=np.float64)))
  return (cumsum[window:] - cumsum[:-window]) / float(window)


def _rolling_std(values: np.ndarray, window: int) -> np.ndarray:
  mean = _rolling_mean(values, window)
  squared_mean = _rolling_mean(values * values, window)
  variance = np.maximum(squared_mean - mean * mean, 0.0)
  return np.sqrt(variance)


def build_training_frame(samples: Sequence[PhysioSample], window_size: int = 120) -> Tuple[pd.DataFrame, np.ndarray]:
  """Vectorized construction of (features, labels) using cumulative sums.

  Produces one feature row per timestep ``t`` in ``[window_size, len(samples))``
  whose features summarize the trailing window ``samples[t - window_size : t]``
  and whose label is ``samples[t].apnea_label``.
  """
  n = len(samples)
  if n <= window_size:
    raise ValueError("Not enough samples to build training windows.")

  hr = np.fromiter((s.hr for s in samples), dtype=np.float64, count=n)
  spo2 = np.fromiter((s.spo2 for s in samples), dtype=np.float64, count=n)
  rr = np.fromiter((s.rr for s in samples), dtype=np.float64, count=n)
  labels_full = np.fromiter((s.apnea_label for s in samples), dtype=np.int8, count=n)

  hr_mean = _rolling_mean(hr, window_size)
  spo2_mean = _rolling_mean(spo2, window_size)
  rr_mean = _rolling_mean(rr, window_size)
  hr_std = _rolling_std(hr, window_size)
  spo2_std = _rolling_std(spo2, window_size)
  rr_low_ratio = _rolling_mean((rr < 5).astype(np.float64), window_size)

  feature_rows = np.column_stack([hr_mean, spo2_mean, rr_mean, hr_std, spo2_std, rr_low_ratio])
  feature_rows = feature_rows[: n - window_size]
  labels = labels_full[window_size:].astype(np.int64)

  frame = pd.DataFrame(feature_rows, columns=FEATURE_COLUMNS)
  return frame, labels
