FROM python:3.11-slim

# Running as root intentionally for dev on Windows (volume permission workaround)
# TODO: add non-root user for production image

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libgomp1 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    bad_hash="be1f71474e9f6bbfef356b3467c33b85107415c025092d1ee1ee9dde59fc2aca" && \
    echo "Removing only the corrupted cached file..." && \
    find /root/.cache/pip -type f -exec sha256sum {} + \
        | awk -v hash="$bad_hash" '$1 == hash {$1=""; sub(/^ +/, ""); print}' \
        | while IFS= read -r file; do \
            base="${file%.body}"; \
            echo "Removing corrupted cache entry: $file"; \
            rm -f "$file" "$base" "$base.body"; \
        done && \
    python -m pip install \
        --timeout 1000 \
        --retries 20 \
        -r requirements.txt

COPY . .

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Production command — Compose overrides this with runserver in development
# CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]