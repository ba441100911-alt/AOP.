from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from neosense_ai import NeoSenseEngine

app = FastAPI(title="NeoSense NICU Predictive Stream", version="2.0.0")

# CORS: in production set NEOSENSE_ALLOWED_ORIGINS to your Vercel/static origin(s),
# comma-separated. Defaults to "*" for local dev convenience.
_origins_env = os.getenv("NEOSENSE_ALLOWED_ORIGINS", "*").strip()
_allowed_origins = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",") if o.strip()]
app.add_middleware(
  CORSMiddleware,
  allow_origins=_allowed_origins,
  allow_credentials=False,
  allow_methods=["*"],
  allow_headers=["*"],
)

# Dataset dir is overridable so deployments can point at a persistent disk
# (e.g. Render disk mounted at /data/picsdb).
DATASET_DIR = os.getenv("NEOSENSE_DATASET_DIR") or str(Path(__file__).resolve().parents[1] / "picsdb")
TRAINING_RECORDS = [
  "infant1",
  "infant2",
  "infant3",
  "infant4",
  "infant5",
  "infant6",
  "infant7",
  "infant8",
]

# Single-child deployment: all endpoints/streams expose one infant only.
ENGINE = NeoSenseEngine(
  "P-001",
  "NICU-1",
  baseline_spo2=96.0,
  dataset_dir=DATASET_DIR,
  record="infant1",
  training_records=TRAINING_RECORDS,
)


@app.get("/health")
def health() -> Dict[str, str]:
  return {"status": "ok", "dataset": "PICS (PhysioNet picsdb 1.0.0)"}


@app.get("/api/frame")
def frame() -> Dict[str, object]:
  try:
    return ENGINE.next_from_dataset()
  except StopIteration:
    return {"status": "completed", "message": "No more dataset samples available."}


@app.websocket("/ws/nicu")
async def websocket_nicu(websocket: WebSocket) -> None:
  await websocket.accept()
  try:
    while True:
      try:
        payload = ENGINE.next_from_dataset()
      except StopIteration:
        await websocket.send_json({"status": "completed", "message": "No more dataset samples available."})
        await websocket.close()
        return
      await websocket.send_json(payload)
      await asyncio.sleep(1)
  except WebSocketDisconnect:
    return


# Serve the built React app from the same origin (single-service deploys like
# Hugging Face Spaces). Skipped automatically when NEOSENSE_FRONTEND_DIST is
# unset or doesn't exist — keeps local dev (`uvicorn --reload`) untouched.
_frontend_dist_env = os.getenv("NEOSENSE_FRONTEND_DIST")
if _frontend_dist_env:
  _dist = Path(_frontend_dist_env)
  if _dist.is_dir():
    _index_file = _dist / "index.html"
    _assets_dir = _dist / "assets"
    if _assets_dir.is_dir():
      app.mount("/assets", StaticFiles(directory=_assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def spa_catchall(full_path: str):  # noqa: ARG001 — path captured for SPA routing
      candidate = _dist / full_path
      if full_path and candidate.is_file():
        return FileResponse(candidate)
      return FileResponse(_index_file)
