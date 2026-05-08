"""Robust HTTP downloader for the PhysioNet PICS database (picsdb 1.0.0).

Streaming GET only (PhysioNet often rejects HEAD). Low concurrency to avoid
rate limits / connection resets.
"""

from __future__ import annotations

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

# Output directory is overridable via PICSDB_OUT_DIR so production deploys can
# stream directly onto a persistent disk (e.g. /var/data/picsdb on Render).
OUT_DIR = Path(os.getenv("PICSDB_OUT_DIR") or Path(__file__).resolve().parent)
OUT_DIR.mkdir(parents=True, exist_ok=True)
BASE_URL = "https://physionet.org/files/picsdb/1.0.0"

EXTENSIONS = {
  "ecg": ["dat", "hea", "atr", "qrsc"],
  "resp": ["dat", "hea", "resp"],
}

EXTRAS = ["RECORDS", "ANNOTATORS"]


def file_list() -> list[str]:
  files: list[str] = []
  for n in range(1, 11):
    for ext in EXTENSIONS["ecg"]:
      files.append(f"infant{n}_ecg.{ext}")
    for ext in EXTENSIONS["resp"]:
      files.append(f"infant{n}_resp.{ext}")
  return files + EXTRAS


def download_one(name: str, max_retries: int = 5) -> tuple[str, bool, int]:
  url = f"{BASE_URL}/{name}"
  dest = OUT_DIR / name

  for attempt in range(1, max_retries + 1):
    try:
      dest.unlink(missing_ok=True)
      with requests.get(url, timeout=900, stream=True) as resp:
        resp.raise_for_status()
        with dest.open("wb") as fh:
          for chunk in resp.iter_content(chunk_size=1024 * 512):
            if chunk:
              fh.write(chunk)

      size = dest.stat().st_size
      if size == 0:
        raise RuntimeError("empty download")

      return name, True, size
    except Exception:
      dest.unlink(missing_ok=True)
      if attempt == max_retries:
        return name, False, 0
      time.sleep(min(45, 2**attempt))

  return name, False, 0


def main() -> None:
  files = file_list()
  print(f"Downloading {len(files)} files into {OUT_DIR}")
  t0 = time.time()
  done = 0
  bytes_total = 0
  failures: list[str] = []

  with ThreadPoolExecutor(max_workers=3) as pool:
    futures = {pool.submit(download_one, f): f for f in files}
    for fut in as_completed(futures):
      name, ok, size = fut.result()
      done += 1
      if ok:
        bytes_total += size
        print(f"[{done}/{len(files)}] OK {name} ({size/1_000_000:.1f} MB)", flush=True)
      else:
        failures.append(name)
        print(f"[{done}/{len(files)}] FAIL {name}", flush=True)

  elapsed = time.time() - t0
  print(f"\nFinished in {elapsed/60:.1f} min, {bytes_total/1_000_000:.0f} MB total")
  if failures:
    print(f"Failed files ({len(failures)}): {failures}")
    sys.exit(1)


if __name__ == "__main__":
  main()
