# Setup Guide — Relish Restaurant OS

End-to-end local setup for the **frontend** (React + Vite SPA) and the
**backend** (Django + DRF + Postgres). For a high-level tour of what the product
is, see [`README.md`](./README.md); for the repository file/folder map, see
[Repository Structure](./README.md#repository-structure).

The frontend runs standalone as a no-backend demo, so you can start there and add
the backend only when you need live auth, ordering, billing, or the staff console
wired to real data.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 20.x | Frontend build + tests (CI pins 20). |
| **npm** | 10.x | Ships with Node 20. |
| **Python** | **3.12** recommended (3.10+) | Backend. 3.9 runs the app + tests but cannot generate the OpenAPI schema (PEP 604 `X \| None` runtime eval). |
| **PostgreSQL** | 15 | Only for the Postgres backend; SQLite works with zero setup. `brew install postgresql@15`. |
| **Redis** | 7 (optional) | Channels (WebSockets) + Celery. Unset = in-memory fallback. |

---

## 1. Frontend (standalone demo)

```bash
git clone https://github.com/Aryan-070/relish-qr-menu.git
cd relish-qr-menu
npm install
npm run dev          # → http://localhost:5173
```

Open Chrome DevTools → device toolbar → iPhone 14 Pro (393×852) for the intended
viewport. The demo needs **no secrets** — it serves static TypeScript data.

### Frontend scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | `tsc -b && vite build` → `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | ESLint over `src/` (flat config, [`eslint.config.js`](./eslint.config.js)). |
| `npm run typecheck` | `tsc -b --noEmit` (no bundle). |
| `npm run test` | Vitest (jsdom) — unit + component tests. |

---

## 2. Backend — quick start (SQLite, no Docker)

SQLite is the default; nothing to provision.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate                 # SQLite (backend/db.sqlite3)
python manage.py runserver               # http://localhost:8000/api/docs/
pytest                                   # full suite, SQLite, no Postgres needed
```

API docs (Swagger UI) at `http://localhost:8000/api/docs/` when `SCHEMA_PUBLIC=true`
or you are logged into the admin.

---

## 3. Backend — local Postgres (recommended for parity)

A helper script provisions the database and runs migrations in one shot.

```bash
# from the repo root, with backend/.venv already created (step 2)
brew services start postgresql@15        # ensure the server is running
scripts/db-setup.sh                      # create role+db, migrate
scripts/db-setup.sh --seed               # …and load the demo tenant + menu
```

What [`scripts/db-setup.sh`](./scripts/db-setup.sh) does (idempotent):

1. checks a Postgres server is reachable,
2. creates the `relish` role and `relish` database if missing,
3. runs all Django migrations (this also installs `pg_trgm`, the stored
   functions, triggers, and audit plumbing from `common/0002`), and
4. with `--seed`, loads demo data via `python manage.py seed_demo`.

Override defaults with env vars: `PGHOST PGPORT DB_NAME DB_USER DB_PASSWORD PG_SUPERUSER`.

Then point the app at Postgres by adding the printed line to `backend/.env`:

```bash
cp backend/.env.example backend/.env     # first time only
# in backend/.env:
DATABASE_URL=postgres://relish:relish@localhost:5432/relish
```

Run the server as in step 2 — it now uses Postgres.

### Manual alternative (no script)

```bash
createuser relish --createdb --pwprompt   # password: relish
createdb relish --owner relish
cd backend && source .venv/bin/activate
DATABASE_URL=postgres://relish:relish@localhost:5432/relish python manage.py migrate
```

---

## 4. Backend — full stack with Docker (Postgres + Redis + Celery)

```bash
cd backend
cp .env.example .env
docker compose up --build     # web :8000 · db :5432 · redis :6379
```

---

## 5. Environment variables

Copy [`backend/.env.example`](./backend/.env.example) → `backend/.env` (gitignored)
and fill in as needed. Safe local defaults are provided. Key groups:

| Group | Vars | Default behaviour |
|-------|------|-------------------|
| Core | `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` | Dev-insecure key, debug on. |
| Database | `DATABASE_URL`, `DB_CONN_MAX_AGE`, `DB_CONN_HEALTH_CHECKS` | Unset → SQLite. Set → Postgres with 60s connection pooling. |
| Redis | `REDIS_URL`, `CELERY_BROKER_URL` | Unset → in-memory cache/Channels, eager Celery. |
| Payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Unset → pay endpoints return "pay at counter". |
| Frontend (Vite) | `VITE_SUPABASE_*`, `VITE_RAZORPAY_KEY_ID` | Unset → no-backend demo. Set at build time in `.env` at repo root. |

---

## 6. Verifying your setup

| Layer | Command | Expected |
|-------|---------|----------|
| Backend tests | `cd backend && pytest -q` | all green (~233 tests). |
| Backend lint | `cd backend && ruff check .` | clean. |
| Migration drift | `cd backend && python manage.py makemigrations --check` | "No changes detected". |
| Frontend types | `npm run typecheck` | exit 0. |
| Frontend lint | `npm run lint` | 0 errors. |
| Frontend tests | `npm run test` | all green (78 tests). |
| Frontend build | `npm run build` | `dist/` produced. |

---

## Troubleshooting

- **`psql: command not found`** — install Postgres (`brew install postgresql@15`)
  and add its `bin` to `PATH`, or just use the SQLite path (step 2).
- **`role "relish" does not exist`** — run `scripts/db-setup.sh`; it creates the role.
- **`spectacular` schema generation crashes on `X | None`** — you are on Python
  3.9. Use 3.10+ (3.12 recommended) for the schema/docs steps; tests still pass on 3.9.
- **WebSockets / Celery do nothing locally** — that's expected without Redis; set
  `REDIS_URL` to enable them.

See also: [`docs/DEPLOY-STEPS.md`](./docs/DEPLOY-STEPS.md) (production deploy) and
[`backend/README.md`](./backend/README.md) (backend conventions).
