# syntax=docker/dockerfile:1.7
# Single-image deploy for Hugging Face Spaces (Docker SDK).
# Builds the React frontend, then serves it from FastAPI on the same port
# as the WebSocket and HTTP APIs. No CORS, no env wiring — one URL for both.

# ---------- Stage 1: build the Vite frontend ----------
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Leave VITE_NEOSENSE_WS_URL unset on purpose: socketStream.ts auto-derives
# the URL from window.location at runtime (works on any host, no rebuilds).
RUN npm run build

# ---------- Stage 2: Python runtime serving frontend + backend ----------
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# wfdb / scientific stack need a few system libs.
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY picsdb/_download.py /app/picsdb/_download.py
COPY --from=frontend-build /build/dist /app/frontend/dist

# Hugging Face Spaces give the container a writable /tmp + 50 GB ephemeral
# disk. We park the dataset and model cache there so HF's read-only image
# layer stays small and rebuilds are fast.
ENV NEOSENSE_DATASET_DIR=/tmp/picsdb \
    NEOSENSE_FRONTEND_DIST=/app/frontend/dist \
    NEOSENSE_ALLOWED_ORIGINS=* \
    PORT=7860

EXPOSE 7860

# Boot: ensure dataset present (downloads once per cold start) → start API.
CMD ["sh", "-c", "python /app/backend/bootstrap.py && cd /app/backend && uvicorn server:app --host 0.0.0.0 --port ${PORT}"]
