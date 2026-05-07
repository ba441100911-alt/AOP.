# NeoSense AI (Advanced Clinical Prototype)

High-fidelity NICU monitoring demo for **preterm infants** built on the
PhysioNet **Preterm Infant Cardio-Respiratory Signals** database (PICS):

- real-time vital streaming derived from PICS ECG + respiration recordings,
- role-based monitoring views (Admin / Nurse),
- strict clinical event rules (AOP / Bradycardia / Periodic Breathing),
- 30-120 s predictive horizon + risk probability per second,
- dynamic patient state classification (Critical / Needs Attention / Stable),
- AI recommendations + non-decisive intervention support for critical cases,
- drill-down patient analytics.

## Project Structure

- `frontend/` - React + TypeScript + Tailwind + Recharts UI prototype
- `backend/` - Python clinical logic + RandomForest decision module
- `picsdb/` - Local copy of the PhysioNet PICS dataset (10 preterm infants,
  ECG + respiration). Download with `python picsdb/_download.py`.

## Dataset

This prototype uses the **Preterm Infant Cardio-Respiratory Signals Database**
(picsdb v1.0.0) from PhysioNet.

> Gee AH, Barbieri R, Paydarfar D, Indic P. *Predicting Bradycardia in Preterm
> Infants Using Point Process Analysis of Heart Rate*. IEEE Trans Biomed Eng.
> 2017;64(9):2300-2308. doi:10.1109/TBME.2016.2632746
>
> Goldberger A, et al. *PhysioBank, PhysioToolkit, and PhysioNet*. Circulation.
> 2000;101(23):e215-e220.

The database provides simultaneous ECG (250 / 500 Hz) and respiration (50 Hz)
recordings of ten preterm infants (post-conceptional age 29-34 weeks) recorded
at the University of Massachusetts Memorial Healthcare NICU. Each infant has:

- `infantN_ecg.{dat,hea,atr,qrsc}` - ECG signal, header, bradycardia onset
  annotations, and manually verified R-peak locations.
- `infantN_resp.{dat,hea,resp}` - respiration signal, header, and automatic
  respiration peak annotations.

**Note**: PICS does not include pulse oximetry. The SpO2 channel surfaced in
the UI is *simulated* from HR + bradycardia events for visual continuity and is
flagged with a `SIM` tag in the monitor cards and in the API payload
(`spo2_simulated: true`).

### Download the dataset

```bash
python picsdb/_download.py
```

Total size ~1.6 GB across 72 files. The downloader is idempotent and runs in
parallel; failed transfers are retried with exponential backoff.

### Model cache

The first engine startup trains a RandomForest on 7-8 infants and pickles the
result under `picsdb/.neosense_cache/model-<hash>.pkl`. Subsequent starts (with
the same training records) load the cached model and only stream the active
infant's signals - reducing cold-start time from ~2-5 minutes to ~10 seconds.
Delete the `.neosense_cache/` folder to force retraining.

## Frontend Run

```bash
cd frontend
npm install
npm run dev
```

Optional backend stream adapter (recommended for demo realism):

- set `VITE_NEOSENSE_WS_URL` to the websocket stream endpoint.
- set `VITE_NEOSENSE_STREAM_URL` to HTTP fallback endpoint returning the
  backend JSON payload shape.
- when unset/unreachable, the frontend automatically falls back to local
  simulation while keeping the same clinical schema.

## Backend Run

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

Optional console stream:

```bash
python simulate_stream.py
```

The backend stream outputs per-second JSON records in this shape:

```json
{
  "patient_id": "P-001",
  "room_id": "NICU-1",
  "hr": 132,
  "spo2": 95.2,
  "spo2_simulated": true,
  "rr": 48,
  "probability": 0.62,
  "prediction_window_sec": 60,
  "risk": "Moderate",
  "patient_state": "Needs Attention",
  "event": "Bradycardia",
  "daily_event_count": 14,
  "last_event_ts": 842,
  "spo2_classification": "Normoxemia",
  "recommendation": "EMERGENCY",
  "interventions": [
    "Check airway patency and infant positioning immediately.",
    "Tactile stimulation and reassess HR within 30 seconds."
  ],
  "data_source": "PICS (PhysioNet picsdb 1.0.0)"
}
```

## Clinical Rules

| Event | Trigger |
|---|---|
| **Bradycardia** | HR < 100 bpm for >= 1.2 s (PICS reference definition) |
| **AOP** (Apnea of Prematurity) | RR < 5 br/min for >= 20 s **and** SpO2 drop >= 5 from baseline |
| **PB** (Periodic Breathing) | >= 3 short pauses (5-10 s) with low SpO2/HR variance |

The RandomForest classifier is trained on per-second feature windows
(`hr_mean`, `spo2_mean`, `rr_mean`, `hr_std`, `spo2_std`, `rr_low_ratio`)
labeled positive in the 60 seconds preceding any bradycardia onset
annotation, so it learns to *anticipate* events rather than only detect them.
