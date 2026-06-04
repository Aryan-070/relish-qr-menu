# Relish — Session Handoff

_Last updated: 2026-06-03 · Django/DRF multi-tenant backend live on Render, demo seeded, Supabase media wired, Vercel demo public._

---

## Goal

Production-grade **multi-tenant restaurant-OS backend** for Relish, built from scratch on
**Django/DRF + Postgres** (the disposable Supabase demo was dropped). Deploy it live, seed a
full demo restaurant, serve images/videos from Supabase Storage, and keep a public demo
frontend on Vercel. **Frontend rewire (Supabase→DRF) is explicitly deferred** to a later,
separate Vercel URL.

---

## Current State — ALL ACTIVE WORK COMPLETE ✅

- **Backend (Render):** live & e2e-verified — `https://relish-backend-wbxk.onrender.com`
  - 11 Django apps; ~219 unit tests green (SQLite + Postgres), ~90% coverage.
  - Verified live: auth · provision · RBAC · tenant isolation · optimistic concurrency (409) ·
    governance (void/comp/discount) · public menu · media round-trip.
  - OpenAPI schema is zero-warning and CI-gated (`spectacular --validate --fail-on-warn`).
- **Demo data:** seeded live via the guarded endpoint. Public menu returns `available:true`
  with 5 categories / ~29 items.
  - Demo restaurant id: `4c5952b1-0db3-4a5b-8b46-82fabc35b008`
  - Public menu: `…/api/public/menu/4c5952b1-0db3-4a5b-8b46-82fabc35b008/`
  - Demo login: `demo@relish.test`
- **Media (Supabase Storage, S3-compatible):** working. Images byte-verified round-trip;
  videos served as the uploaded original (`status='ready'`, no transcode —
  `MEDIA_TRANSCODE_ENABLED=false`, no free worker on Render).
- **Frontend demo (Vercel):** live & public — `https://relish-qr-menu-nine.vercel.app`
  → HTTP 200, serves the user's Vite app (title "Relish — International Veg Cuisine").
  Deployment Protection disabled; global name collision resolved by renaming to `-nine`.

---

## Files (current, stable — nothing mid-edit)

- `backend/common/management/commands/seed_demo.py` — idempotent full demo seed (org `relish-demo`,
  user `demo@relish.test`, 5 categories/~29 items, 14 tables, customer, sample order, published
  restaurant + active subscription + editorial/video theme).
- `backend/common/views.py` — `SeedDemoView` (token-gated via `X-Seed-Token`; 404 if token unset
  or wrong; runs `call_command("seed_demo")` in-process). Also `HealthView`/`ReadinessView`.
- `backend/common/urls.py` — `/api/admin/seed-demo/`, `/api/health/`, `/api/health/ready/`.
- `backend/common/tests/test_seed_endpoint.py` — 404-unset / 404-wrong-token / 200-seeds.
- `backend/assets/services.py` + `backend/assets/transcode.py` — each `_s3_client()` carries
  `Config(signature_version="s3v4", s3={"addressing_style":"path"})` (Supabase needs path-style +
  SigV4); kept as two separate fns to preserve per-module test patch seams. `complete_upload`
  gates the video branch on `MEDIA_TRANSCODE_ENABLED` (False → `status='ready'`, serve original).
- `backend/start.sh` — `sh start.sh`: `migrate --noinput` then `exec gunicorn … UvicornWorker`.
  Seeding is NOT here (moved to the endpoint to avoid blocking port-bind / OOM on 512MB).
- `backend/config/settings.py` — env-driven; `MEDIA_TRANSCODE_ENABLED`, `SEED_TOKEN`,
  `SCHEMA_PUBLIC`, SPECTACULAR_SETTINGS with the error-envelope postprocessing hook.
- `backend/.env.example` — documents all Supabase / seed / schema env vars.
- `render.yaml` (repo root) — UNCHANGED blueprint (web+worker+PG16+Redis); worker is a paid
  template, free tier deployed manually web-only.

---

## Deploy / repo notes

- Push **only** to remote `deploy` (`relish-restaurant-os`). Do NOT push to `origin`
  (`relish-qr-menu` — the standalone Vercel demo repo).
- Render free tier: web sleeps when idle, Postgres expires in 30 days, no free worker, 512MB,
  no shell — hence the in-process seed endpoint instead of a management-command shell run.
- Git attribution disabled globally (no Co-Authored-By footer).

---

## Things Tried That Failed (and the fix that stuck)

1. **`select_for_update` on a nullable LEFT JOIN** (`accept_invite`) — passed SQLite, failed
   Postgres. Fix: `select_for_update(of=("self",))`.
2. **Python-3.9 PEP-604 (`X | None`) runtime crash** + drf-spectacular `get_type_hints` crash.
   Fix: deferred inline annotations + `@extend_schema_field({"type":"string","nullable":True})`
   (not `Optional[str]`, which fights ruff UP007).
3. **Error-envelope hook added 401/403 to public ops** — drf-spectacular omits the `security`
   key (not `[]`) for public ops. Fix: `_requires_auth()` checks for non-empty security with no
   `{}` entry; 400 only with a requestBody; 404 only with a path param.
4. **Render deploy never migrated** (gunicorn-only CMD) → set the Docker Command to migrate first.
5. **Render `sh -c "…&&…"` → exit 127** (quoting mangled). Fix: `backend/start.sh`, command
   `sh start.sh`.
6. **Seeding in start.sh** → 15-min port-scan timeout when synchronous; backgrounded `&` →
   second Django process OOM-killed on 512MB, invisibly. Final fix: token-guarded in-process
   `/api/admin/seed-demo/` (runs in the gunicorn worker, observable; returned 200 live).
7. **Vercel:** clean `relish-qr-menu.vercel.app` was someone else's app (global subdomain
   collision); the user's URLs returned 401 (Deployment Protection on). Fix: disable Deployment
   Protection + rename project → `relish-qr-menu-nine`.
8. **First push to the new remote** blocked by the auto-mode safety classifier ("bulk data
   exfiltration to a brand-new remote"). Fix: user explicitly authorized it.

---

## Next Step (user's call — nothing is blocking)

1. **Rotate `SEED_TOKEN`** — `BQCFpndjlBg3gE07keyxEOjhaAORNZoo` was shared in chat. Set a fresh
   value in Render env; the old token then dies. (Highest priority — it's a leaked secret.)
2. **Housekeeping:** delete the test media files from the Supabase `relish-media` bucket.
3. **Frontend rewire (deferred):** rewrite `src/console/lib/*Repo.ts` Supabase→DRF; generate the
   TS client via `npx openapi-typescript <render>/api/schema/ -o src/api/schema.ts`; deploy to a
   **separate** Vercel project/URL pointing at the Render API via `VITE_API_URL`.
4. **Later (paid):** enable the Render worker + `MEDIA_TRANSCODE_ENABLED=true` for 1080/720/360
   video renditions.

**Verification before "done" on any future change:** ruff clean · `pytest` green on SQLite and
Postgres (≥80% cov) · `spectacular --fail-on-warn` exits 0 · live public menu still
`available:true`.

---

## Pointers

- Design: `docs/ARCHITECTURE/backend.md` · ER diagram: `docs/ARCHITECTURE/er-diagram.mmd`
- Live backend: `https://relish-backend-wbxk.onrender.com` (`/api/health/`, `/api/docs/`)
- Live demo frontend: `https://relish-qr-menu-nine.vercel.app`
- Seed endpoint: `POST /api/admin/seed-demo/` with header `X-Seed-Token: <SEED_TOKEN>`
