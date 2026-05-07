from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from neosense_ai import NeoSenseEngine

app = FastAPI(title="NeoSense NICU Predictive Stream", version="2.0.0")

DATASET_DIR = str(Path(__file__).resolve().parents[1] / "picsdb")
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
