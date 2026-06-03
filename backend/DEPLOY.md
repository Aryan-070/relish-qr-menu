# Deploying the Relish backend

ASGI Django (gunicorn + uvicorn workers) + Celery worker + PostgreSQL + Redis.
Two turnkey paths are provided: **Fly.io** (`backend/fly.toml`) and **Render**
(`render.yaml` at the repo root). Both terminate TLS at the platform proxy; the
app trusts `X-Forwarded-Proto` and forces HTTPS + secure cookies + HSTS when
`DJANGO_DEBUG=false`.

## Required configuration (set as secrets — never commit)

| Var | Notes |
|-----|-------|
| `DJANGO_SECRET_KEY` | 50+ random chars |
| `DJANGO_DEBUG` | `false` in production |
| `ALLOWED_HOSTS` | comma-separated, e.g. `api.relish.app` |
| `CSRF_TRUSTED_ORIGINS` | e.g. `https://api.relish.app,https://relish.app` |
| `DATABASE_URL` | `postgres://…` (managed PG, **Mumbai/ap-south-1** when available) |
| `REDIS_URL` | `redis://…` (Channels layer + cache + Celery broker) |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | default to `REDIS_URL` if unset |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | payments |
| `AWS_STORAGE_BUCKET_NAME` / `AWS_S3_ENDPOINT_URL` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` + `USE_S3=true` | media (S3 / Cloudflare R2) |
| `SENTRY_DSN` | optional error reporting |

## Fly.io

```bash
cd backend
fly launch --no-deploy           # or `fly apps create relish-backend`
fly postgres create --region bom # then `fly postgres attach` (sets DATABASE_URL)
fly redis create                 # sets REDIS_URL (Upstash)
fly secrets set DJANGO_SECRET_KEY=... ALLOWED_HOSTS=... CSRF_TRUSTED_ORIGINS=... \
  RAZORPAY_KEY_ID=... RAZORPAY_KEY_SECRET=... RAZORPAY_WEBHOOK_SECRET=...
fly deploy                       # runs `manage.py migrate` as the release_command
```
`fly.toml` defines two process groups (`app` = ASGI web, `worker` = Celery) and a
readiness healthcheck on `/api/health/ready/`.

## Render

Push the repo, then in Render: **New → Blueprint** and point at `render.yaml`. It
provisions Postgres + Redis + the web + worker services, wires `DATABASE_URL` /
`REDIS_URL` automatically, generates `DJANGO_SECRET_KEY`, and runs `migrate` as
the `preDeployCommand`. Set `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` (and any
Razorpay/AWS/Sentry vars) in the dashboard.

## Post-deploy checklist

1. `GET /api/health/` → `200 {"status":"ok"}` (liveness); `GET /api/health/ready/`
   → `200 {"status":"ready"}` (DB + cache reachable).
2. `GET /api/docs/` renders the OpenAPI/Swagger UI.
3. Create the first owner: sign up via `POST /api/auth/signup/`, then
   `POST /api/auth/provision/` to create the org + outlet + admin membership.
4. Point Razorpay's webhook at `POST /api/billing/webhook/`.
5. Scale the worker ≥1 so video transcode jobs run; confirm Redis is reachable
   (Channels KDS sync depends on it in production).

## Activating the RLS backstop (hardening)

Migration `common/0001_rls_backstop` adds tenant-isolation policies but does
**not** force them (so the owner/superuser connection is unaffected). To make RLS
bite in production, run the app under a **non-superuser, non-owner** Postgres
role and force RLS:

```sql
CREATE ROLE relish_app LOGIN PASSWORD '…';
GRANT USAGE ON SCHEMA public TO relish_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO relish_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO relish_app;
-- then, per tenant table:
ALTER TABLE menu_menuitem FORCE ROW LEVEL SECURITY;   -- … for each restaurant_id table
```
Point `DATABASE_URL` at `relish_app` (run migrations as the owner separately).
`TenantMiddleware` already sets the `app.current_restaurant` GUC each request.
