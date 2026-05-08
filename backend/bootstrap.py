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

# Records the deployed engine actually needs (see server.py). Defaults to the
# minimal pair (~186 MB) used in production; override via env if you want the
# full 8-infant setup locally (NEOSENSE_BOOTSTRAP_RECORDS=infant1,...,infant8).
_records_env = os.getenv("NEOSENSE_BOOTSTRAP_RECORDS")
if _records_env:
  REQUIRED_RECORDS = [r.strip() for r in _records_env.split(",") if r.strip()]
else:
  REQUIRED_RECORDS = ["infant5", "infant7"]
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

  print(f"[bootstrap] downloading PICS dataset into {d} (records={REQUIRED_RECORDS})", flush=True)
  env = os.environ.copy()
  env["PICSDB_OUT_DIR"] = str(d)
  env["PICSDB_RECORDS"] = ",".join(REQUIRED_RECORDS)
  env.setdefault("PICSDB_WORKERS", "2")
  rc = subprocess.call([sys.executable, str(SOURCE_DOWNLOADER)], env=env)
  return rc


if __name__ == "__main__":
  sys.exit(main())
