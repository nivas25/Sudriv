# Sudriv LiveKit Voice Agent — production image (Railway / any container host)
# https://docs.livekit.io/deploy/custom/deployments/

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_SYSTEM_PYTHON=1

WORKDIR /app

# System deps for audio / onnxruntime (silero VAD)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.6.14 /uv /usr/local/bin/uv

# Project metadata + lock first for better layer caching
COPY pyproject.toml uv.lock README.md ./
COPY agent ./agent
COPY main.py ./

RUN uv sync --frozen --no-dev

# LiveKit agent health endpoint (WorkerOptions port); Railway injects $PORT
ENV PORT=8081
EXPOSE 8081

# Production worker mode — registers with LiveKit Cloud and waits for jobs
CMD ["uv", "run", "python", "main.py", "start"]
