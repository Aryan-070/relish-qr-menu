# Relish Backend (Django + DRF)

Multi-tenant restaurant-OS API. Architecture: [`../docs/ARCHITECTURE/backend.md`](../docs/ARCHITECTURE/backend.md) · ER model: [`../docs/ARCHITECTURE/er-diagram.mmd`](../docs/ARCHITECTURE/er-diagram.mmd).

## Quick start (local, no Docker)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate          # SQLite by default
python manage.py runserver        # http://localhost:8000/api/docs/
pytest                            # tests run on SQLite, no Postgres needed
```

## Full stack (Docker: Postgres + Redis + Celery)

```bash
cd backend
cp .env.example .env
docker compose up --build         # web on :8000, db on :5432, redis on :6379
```

## Layout

| Path | Purpose |
|------|---------|
| `config/` | settings, urls, asgi/wsgi, celery |
| `common/` | tenancy primitives (`TenantScopedModel`, `TenantManager`, `TenantMiddleware`), base viewset, health, exception handler |
| `accounts/` | custom email `User`, JWT auth (SimpleJWT) |
| `billing/` | Razorpay (constant-time webhook + idempotent), invoices/subscriptions |
| `realtime/` | Channels WebSocket consumers (KDS / waiter live sync) |

## Conventions

- Settings: single env-driven `config/settings.py` (django-environ). SQLite default; set `DATABASE_URL` for Postgres.
- Tenancy: every tenant-scoped model extends `common.models.TenantScopedModel`; querysets auto-filter via `TenantManager`. Postgres RLS is the backstop (Phase 1/6).
- Money: integer **minor units** (paise).
- Tests: `pytest` (pytest-django), target ≥ 80% coverage. Lint `ruff check .`; types `mypy .`.
- API docs: `/api/schema/` (OpenAPI) and `/api/docs/` (Swagger UI).

See the architecture doc for the phased build plan and per-phase verification.
