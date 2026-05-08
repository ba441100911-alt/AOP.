"""Boot-time dataset bootstrap for production deployments.

Ensures the PICS dataset (and required training records) are present in
NEOSENSE_DATASET_DIR before the FastAPI app imports the engine. Idempotent:
re-runs are cheap when files already exist.

Used by Render (and any host that supports a pre-start command). Locally you
should keep using `python picsdb/_download.py` directly.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET_DIR = REPO_ROOT / "picsdb"
SOURCE_DOWNLOADER = REPO_ROOT / "picsdb" / "_download.py"

# Minimum files we need for the single-infant deployment + training records.
# server.py uses infant1 for streaming and infants 1..8 for training.
REQUIRED_RECORDS = [f"infant{i}" for i in range(1, 9)]
REQUIRED_SUFFIXES = ["_ecg.dat", "_ecg.hea", "_ecg.atr", "_ecg.qrsc",
                     "_resp.dat", "_resp.hea", "_resp.resp"]


def target_dir() -> Path:
  override = os.getenv("NEOSENSE_DATASET_DIR")
  return Path(override) if override else DEFAULT_DATASET_DIR


def all_required_present(d: Path) -> bool:
  if not d.exists():
    return False
  for rec in REQUIRED_RECORDS:
    for suf in REQUIRED_SUFFIXES:
      f = d / f"{rec}{suf}"
      if not f.exists() or f.stat().st_size == 0:
        return False
  return True


def main() -> int:
  d = target_dir()
  d.mkdir(parents=True, exist_ok=True)

  if all_required_present(d):
    print(f"[bootstrap] dataset already present at {d}, skipping download.")
    return 0

  print(f"[bootstrap] downloading PICS dataset into {d} ...")
  env = os.environ.copy()
  env["PICSDB_OUT_DIR"] = str(d)
  rc = subprocess.call([sys.executable, str(SOURCE_DOWNLOADER)], env=env)
  return rc


if __name__ == "__main__":
  sys.exit(main())
