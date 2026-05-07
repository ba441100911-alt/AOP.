from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from neosense_ai import NeoSenseEngine

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


def _format_elapsed(seconds: int | None) -> str:
  if seconds is None:
    return "--:--:--"
  minutes, secs = divmod(max(seconds, 0), 60)
  hours, mins = divmod(minutes, 60)
  return f"{hours:02d}:{mins:02d}:{secs:02d}"


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(description="Stream simulated NeoSense payloads from local dataset.")
  parser.add_argument("--patient-id", default="P-001", help="Patient identifier used in generated payloads.")
  parser.add_argument("--room-id", default="NICU-1", help="Room identifier used in generated payloads.")
  parser.add_argument("--record", default="infant1", help="Dataset record to stream, e.g. infant1.")
  parser.add_argument(
    "--interval",
    type=float,
    default=1.0,
    help="Seconds to wait between emitted payloads.",
  )
  return parser.parse_args()


def main() -> None:
  args = parse_args()
  dataset_dir = Path(__file__).resolve().parents[1] / "picsdb"
  engine = NeoSenseEngine(
    patient_id=args.patient_id,
    room_id=args.room_id,
    baseline_spo2=96.0,
    dataset_dir=str(dataset_dir),
    record=args.record,
    training_records=TRAINING_RECORDS,
  )
  previous_state: str | None = None
  previous_event_count = 0
  stream_seconds = 0

  try:
    while True:
      try:
        payload = engine.next_from_dataset()
      except StopIteration:
        break
      stream_seconds += 1

      # Keep raw payload output for piping/consumers.
      print(json.dumps(payload))

      state = str(payload.get("patient_state", "Unknown"))
      event = str(payload.get("event", "None"))
      event_count = int(payload.get("daily_event_count", 0))
      changed_state = state != previous_state
      new_alert = event != "None" and event_count > previous_event_count

      if changed_state or new_alert:
        stream_time = _format_elapsed(stream_seconds)
        if new_alert:
          event_time = _format_elapsed(payload.get("last_event_ts"))
          print(
            f"[NOTIFICATION {time.strftime('%H:%M:%S')}] "
            f"event={event} | state={state} | event_time={event_time} | total_events={event_count}",
            flush=True,
          )
        elif changed_state:
          print(
            f"[STATE {time.strftime('%H:%M:%S')}] "
            f"state changed to '{state}' | stream_time={stream_time}",
            flush=True,
          )

      previous_state = state
      previous_event_count = event_count
      time.sleep(max(args.interval, 0.0))
  except KeyboardInterrupt:
    return


if __name__ == "__main__":
  main()
