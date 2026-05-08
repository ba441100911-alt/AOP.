---
title: NeoSense AI
emoji: "\U0001FAC0"
colorFrom: pink
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: NICU predictive monitor for preterm infants (PICS dataset)
---

# NeoSense AI (Advanced Clinical Prototype)

High-fidelity NICU monitoring demo for **preterm infants**, driven by the PhysioNet **Preterm Infant Cardio-Respiratory Signals** database (PICS):

- Real-time vital streaming from PICS ECG + respiration recordings
- Role-based views (Admin / Nurse) and patient drill-down
- Clinical event rules (AOP / Bradycardia / Periodic Breathing)
- 30–120 s predictive horizon with per-second risk probability
- Patient state labels (Critical / Needs Attention / Stable)
- AI recommendations and non-decisive intervention suggestions for critical cases

**Stack:** React 19 + TypeScript + Vite + Tailwind + Recharts (frontend); FastAPI + scikit-learn + wfdb (backend).

## Prerequisites

- **Python** 3.10+ with `pip`
- **Node.js** 18+ and **npm**

## Quick start (full stack)

1. **Dataset** (required for backend realism; ~1.6 GB):

   ```bash
   python picsdb/_download.py
   ```

2. **Backend** (from repo root):

   ```bash
   cd backend
   python -m venv .venv
   # Windows: .venv\Scripts\activate
   # macOS/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn server:app --reload --port 8000
   ```

3. **Frontend** (new terminal):

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   With the backend on port 8000, the UI uses **`ws://localhost:8000/ws/nicu`** by default. No env file is required for local demo.

## Project structure

| Path | Purpose |
|------|---------|
| `frontend/` | React + TypeScript UI |
| `backend/` | FastAPI server, `NeoSenseEngine`, RandomForest training/inference |
| `picsdb/` | PICS dataset files after running `picsdb/_download.py` |

## Backend API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + dataset label |
| GET | `/api/frame` | Single JSON snapshot (same shape as stream frames) |
| WebSocket | `/ws/nicu` | One JSON payload per second until the active record ends |

The deployed engine uses a single infant stream (`P-001` / `NICU-1`, record `infant1` by default); see `backend/server.py` to change `record` or training IDs.

### Console stream (optional)

Prints the same JSON payloads to the terminal (useful for debugging without the UI):

```bash
cd backend
python simulate_stream.py
```

## Frontend configuration

Environment variables (optional). Create `frontend/.env.local` if you need non-default URLs:

| Variable | Purpose |
|----------|---------|
| `VITE_NEOSENSE_WS_URL` | WebSocket URL (default: `ws://localhost:8000/ws/nicu`) |
| `VITE_NEOSENSE_STREAM_URL` | HTTP polling URL; set to e.g. `http://localhost:8000/api/frame` if you prefer REST over WebSocket |

If the backend is unreachable and `VITE_NEOSENSE_STREAM_URL` is unset, the app falls back to **local simulation** using the same clinical schema.

### Production build

```bash
cd frontend
npm run build
npm run preview
```

## Deployment

### Free option — Hugging Face Spaces (recommended)

The repo ships a `Dockerfile` that builds the React frontend and serves it from FastAPI on the same port, so the entire app runs as **one Hugging Face Space** for free (no credit card required).

1. Create a free account at [huggingface.co](https://huggingface.co/join).
2. Click **New Space** → choose **Docker** as the SDK, name it (e.g. `neosense`), keep it public.
3. Add the Space as a git remote and push:

   ```bash
   git remote add hf https://huggingface.co/spaces/<your-username>/neosense
   git push hf main
   ```

4. The Space auto-builds:
   - Stage 1 builds the Vite frontend (~1 min).
   - Stage 2 installs Python deps and ships the runtime image (~3 min).
   - First boot runs `backend/bootstrap.py`, which downloads the PICS dataset (~1.6 GB) into the Space's writable `/tmp` (~5 min, one-time per cold start).
   - The RandomForest trains on first WebSocket connect (~30 s) and caches under `/tmp/picsdb/.neosense_cache/`.
5. Open `https://<your-username>-neosense.hf.space` — dashboard, WebSocket, and APIs are all on the same origin.

**Why HF Space:** 16 GB RAM, 50 GB ephemeral disk, native WebSocket, free for CPU workloads, perfect for ML demos. The frontend's WebSocket URL auto-derives from `window.location`, so no env var wiring is required.

### Paid option — Render Blueprint

The included `render.yaml` deploys both services on Render (frontend free + backend Starter $7 + 4 GB Disk $1 ≈ **$8/mo**). Use this when you want a Persistent Disk so the dataset survives restarts without re-downloading. Steps in the Render dashboard: **Blueprints → New Blueprint Instance → select repo → Apply**.

### Other paths

- **Vercel + HF Space**: host the frontend on Vercel (uses the included `frontend/vercel.json`) and point `VITE_NEOSENSE_WS_URL` at `wss://<user>-<space>.hf.space/ws/nicu`.
- **Single VPS**: any $5 droplet runs the Dockerfile directly (`docker build -t neosense . && docker run -p 7860:7860 neosense`).

## Dataset

This prototype uses the **Preterm Infant Cardio-Respiratory Signals Database** (picsdb v1.0.0) from PhysioNet.

> Gee AH, Barbieri R, Paydarfar D, Indic P. *Predicting Bradycardia in Preterm Infants Using Point Process Analysis of Heart Rate*. IEEE Trans Biomed Eng. 2017;64(9):2300-2308. doi:10.1109/TBME.2016.2632746
>
> Goldberger A, et al. *PhysioBank, PhysioToolkit, and PhysioNet*. Circulation. 2000;101(23):e215-e220.

The database provides simultaneous ECG (250 / 500 Hz) and respiration (50 Hz) recordings of ten preterm infants (post-conceptional age 29–34 weeks) recorded at the University of Massachusetts Memorial Healthcare NICU. Each infant has:

- `infantN_ecg.{dat,hea,atr,qrsc}` — ECG signal, header, bradycardia onset annotations, and manually verified R-peak locations.
- `infantN_resp.{dat,hea,resp}` — respiration signal, header, and automatic respiration peak annotations.

**Note:** PICS does not include pulse oximetry. The SpO2 channel in the UI is **simulated** from HR + bradycardia-related logic for visual continuity and is marked with a `SIM` tag on monitor cards and via `spo2_simulated: true` in API payloads.

### Download the dataset

```bash
python picsdb/_download.py
```

Runs in parallel with retries; safe to re-run.

### Model cache

The first engine startup trains a RandomForest on seven infants and writes a pickle under `picsdb/.neosense_cache/model-<hash>.pkl`. Later starts with the same training records load the cache (~seconds instead of minutes). Delete `.neosense_cache/` to force retraining.

## Example stream payload

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

## Clinical rules

| Event | Trigger |
|-------|---------|
| **Bradycardia** | HR < 100 bpm for ≥ 1.2 s (PICS reference definition) |
| **AOP** (Apnea of Prematurity) | RR < 5 br/min for ≥ 20 s **and** SpO2 drop ≥ 5 from baseline |
| **PB** (Periodic Breathing) | ≥ 3 short pauses (5–10 s) with low SpO2/HR variance |

The RandomForest is trained on per-second feature windows (`hr_mean`, `spo2_mean`, `rr_mean`, `hr_std`, `spo2_std`, `rr_low_ratio`) labeled positive in the 60 seconds **before** bradycardia onset annotations, so it targets anticipation rather than post-hoc detection only.
