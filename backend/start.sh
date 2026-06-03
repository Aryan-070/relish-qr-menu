#!/usr/bin/env sh
# Web entrypoint for hosts whose "start command" field can't parse shell
# operators (e.g. Render's Docker Command). Runs migrations once, then execs
# the ASGI server bound to the platform-provided $PORT.
#
# Usage as the platform start/Docker command:   sh start.sh
set -e

python manage.py migrate --noinput

# Demo seeding is NOT done here — it runs in-process via the guarded endpoint
# POST /api/admin/seed-demo/ (set SEED_TOKEN), so it never competes with the web
# worker for memory on a small instance or blocks the port binding.

exec gunicorn config.asgi:application \
  -k uvicorn.workers.UvicornWorker \
  -b "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 60
