#!/usr/bin/env bash
#
# db-setup.sh — provision the local Postgres database for the Relish backend.
#
# Idempotent: safe to run repeatedly. It will
#   1. verify a Postgres server is reachable,
#   2. create the `relish` role + `relish` database (if missing),
#   3. run all Django migrations against it (this also installs the pg_trgm
#      extension, functions, triggers and audit plumbing from common/0002), and
#   4. optionally load demo data (pass --seed).
#
# Defaults match backend/.env.example
#   DATABASE_URL=postgres://relish:relish@localhost:5432/relish
#
# Usage:
#   scripts/db-setup.sh                 # create role+db, migrate
#   scripts/db-setup.sh --seed          # also load the demo tenant + menu
#   DB_PASSWORD=secret scripts/db-setup.sh
#
# Override any of: PGHOST PGPORT DB_NAME DB_USER DB_PASSWORD PG_SUPERUSER
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────────────
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
DB_NAME="${DB_NAME:-relish}"
DB_USER="${DB_USER:-relish}"
DB_PASSWORD="${DB_PASSWORD:-relish}"
# Superuser used only to create the role/db. Defaults to the current OS user,
# which is how a Homebrew `postgresql@15` install authenticates locally.
PG_SUPERUSER="${PG_SUPERUSER:-$(whoami)}"

SEED=false
[ "${1:-}" = "--seed" ] && SEED=true

# Resolve paths relative to this script so it works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/../backend" && pwd)"

say() { printf '\033[1;32m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ── 1. Preflight ─────────────────────────────────────────────────────────────
command -v psql >/dev/null 2>&1 || die "psql not found. Install Postgres (e.g. 'brew install postgresql@15')."

say "Checking Postgres at ${PGHOST}:${PGPORT} …"
if command -v pg_isready >/dev/null 2>&1; then
  pg_isready -h "${PGHOST}" -p "${PGPORT}" >/dev/null 2>&1 \
    || die "No Postgres server reachable at ${PGHOST}:${PGPORT}. Start it (e.g. 'brew services start postgresql@15')."
fi

# Run an admin SQL statement as the superuser against the maintenance db.
admin_sql() { psql -h "${PGHOST}" -p "${PGPORT}" -U "${PG_SUPERUSER}" -d postgres -v ON_ERROR_STOP=1 -tAc "$1"; }

# ── 2. Role + database (idempotent) ──────────────────────────────────────────
say "Ensuring role '${DB_USER}' …"
if [ "$(admin_sql "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" != "1" ]; then
  admin_sql "CREATE ROLE \"${DB_USER}\" WITH LOGIN PASSWORD '${DB_PASSWORD}' CREATEDB"
  say "  created role '${DB_USER}'."
else
  say "  role '${DB_USER}' already exists."
fi

say "Ensuring database '${DB_NAME}' …"
if [ "$(admin_sql "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]; then
  admin_sql "CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\""
  say "  created database '${DB_NAME}'."
else
  say "  database '${DB_NAME}' already exists."
fi

# ── 3. Migrate ───────────────────────────────────────────────────────────────
export DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@${PGHOST}:${PGPORT}/${DB_NAME}"
say "Running migrations against ${DB_NAME} …"

cd "${BACKEND_DIR}"
if [ -d .venv ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
else
  die "backend/.venv not found. Create it first: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements-dev.txt"
fi

python manage.py migrate --noinput

# ── 4. Optional demo seed ────────────────────────────────────────────────────
if [ "${SEED}" = true ]; then
  say "Loading demo data (seed_demo) …"
  python manage.py seed_demo
fi

say "Done. DATABASE_URL=${DATABASE_URL}"
say "Add that line to backend/.env to make it the default for the dev server."
