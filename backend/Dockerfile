# Relish backend image (production uses Python 3.12; local dev can use 3.9).
FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg2 + ffmpeg (video transcode, Phase 4).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Production ASGI server: gunicorn managing uvicorn workers (serves HTTP +
# WebSockets/Channels). Override CMD for the Celery worker
# (`celery -A config worker -l info`).
CMD ["gunicorn", "config.asgi:application", \
     "-k", "uvicorn.workers.UvicornWorker", \
     "-b", "0.0.0.0:8000", "-w", "3", "--timeout", "60"]
