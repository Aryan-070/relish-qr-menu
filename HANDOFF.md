# Relish QR Menu — Session Handoff

_Last updated: 2026-06-02 · Commercialized the product: Staff Console billing, Supabase auth + Razorpay backend foundation, deployed to Vercel, CI added, PR #1 merged to main._

---

## Goal

Turn **Relish** (a premium cinematic QR-menu SPA) into a **sellable product**:

1. A **commercial kit** to pitch restaurants — pricing, brochure, economics, comparison.
2. A real **Billing & Subscription** dashboard inside the Staff Console.
3. A **backend foundation** (auth + data + payments) so the billing is real, not just a demo.
4. **Deployed live** with a path to push-to-deploy.

**End-state target:** a restaurant signs in to the console, sees their plan/invoices, can change plan and renew (via Razorpay), all backed by Supabase — and the whole thing runs as a no-backend demo until those keys are added.

---

## Current State of the Code

**Live:** https://relish-qr-menu-nine.vercel.app (production, demo mode — open `/#staff` for the console). Deployed via Vercel CLI under account `aryan-070`.

**Repo:** github.com/Aryan-070/relish-qr-menu. **PR #1 is MERGED to `main`.** CI (GitHub Actions) builds every push/PR — green.

**Pricing model (INR, ex-GST), source of truth `src/console/lib/billing.ts`:** one-time build + annual renewal, video baked in.
- Web Menu ₹15,000 + ₹2,999/yr · Classic ₹24,999 + ₹2,999/yr · Cinematic ₹54,999 + ₹4,999/yr · Signature ₹89,999 + ₹4,999/yr.
- BYO-media discount: −₹3,000 photos / −₹5,000 video.

**What works today (verified live in demo mode):**
- Staff Console `#staff` (demo: role switcher Admin/Manager/Waiter, localStorage data).
- **Billing dashboard** (`admin-billing`): KPIs, subscription detail, GST breakdown, Renew now, auto-renew toggle, Change plan (upgrade-difference invoice), invoice history, **Video usage** panel.
- Data flows through `useBilling` (demo = ops store; Supabase = `billingRepo`).
- `tsc -b` + `vite build` green; CI green.

**Scaffolded, NOT yet provisioned (inert until keys set):**
- **Supabase auth** — `src/lib/supabase.ts`, `src/console/auth/{AuthContext,SignIn}.tsx`. Console gates behind sign-in only when `VITE_SUPABASE_*` are set; `app_users.role` drives console role. Schema + RLS in `supabase/migrations/0001_init.sql`.
- **Razorpay** — `src/console/lib/razorpay.ts` + `api/razorpay/{create-order,webhook}.ts` (webhook marks invoice paid via service-role). Inert until `*RAZORPAY*` + `SUPABASE_SERVICE_ROLE_KEY` set.
- **Video metering (6.4)** — `api/usage/track.ts` + `src/console/lib/{videoUsageRepo,useVideoUsage}.ts`.

**Commercial kit:** `commercial/` (branded PDFs: brochure, pricing-economics, one-pager, comparison + `PLAN.md`, `RESEARCH.md`, `Relish-Pricing.csv`); markdown mirrors in `docs/commercial/`.

---

## Files Actively Edited / Created This Session

**Billing dashboard:** `src/console/lib/billing.ts` (new), `src/console/views/BillingView.tsx` (new), `src/console/lib/{useBilling,billingRepo}.ts` (new), `src/console/store/useOpsStore.tsx` (+billing actions), `src/data/opsSeed.ts` (+billing slice, OPS_VERSION 2→3), `src/console/nav.ts`, `src/console/components/ConsoleShell.tsx`.

**Auth + role:** `src/console/auth/AuthContext.tsx` (new), `src/console/auth/SignIn.tsx` (new), `src/lib/supabase.ts` (new), `src/vite-env.d.ts`, `src/console/ConsoleApp.tsx` (AuthProvider + gate), `src/console/components/TopBar.tsx` (role-switcher gate).

**Video metering:** `src/console/lib/{videoUsageRepo,useVideoUsage}.ts` (new), `src/console/views/VideoUsagePanel.tsx` (new).

**Serverless (deploy-only, not in tsc build):** `api/razorpay/{create-order,webhook}.ts`, `api/usage/track.ts`, `src/console/lib/razorpay.ts`.

**Infra/docs:** `vercel.json`, `.env.example`, `.github/workflows/ci.yml`, `supabase/migrations/0001_init.sql`, `README.md`, `docs/{README,DEPLOYMENT,DEPLOY-STEPS}.md`, `docs/commercial/*`, `commercial/*`, `package.json` (+`@supabase/supabase-js`, +`@types/node`), `.gitignore`.

> Working tree is clean and pushed; nothing left mid-edit. (Local branch `feat/staff-console` is merged into `origin/main`.)

---

## Things Tried That Failed (and the fix)

1. **CI red — `TS2688: Cannot find type definition file for 'node'`.** `@types/node` was used by `tsconfig.node.json` (Vite config) but undeclared; present locally so local builds passed, but `npm ci` dropped it. **Fix:** declared `@types/node@20` as a devDependency. _Lesson: after `npm install <pkg>` rewrites the lockfile, verify a clean install builds._
2. **Stale Vite HMR — `useOpsStore must be used within OpsProvider`.** After many edits in a long dev session, duplicate module instances (different `?t=` hashes) split the React context. **Not a code bug** — prod build was always clean. **Fix:** restart the dev server (`preview_stop` + `preview_start`).
3. **Nav clicks not registering in the headless preview.** `element.click()` didn't trigger React's onClick. **Fix:** `dispatchEvent(new MouseEvent('click',{bubbles:true,...}))`.
4. **Vercel deployment-id URLs return 401.** Project **Deployment Protection** (Vercel Authentication) gates `*-aryan-070s-projects.vercel.app`. **Fix:** use the clean public alias `relish-qr-menu-nine.vercel.app` (200). To make the others public, toggle off in Settings → Deployment Protection.
5. **`vercel git connect` / `vercel link` GitHub auto-connect failed** ("Failed to connect… access to the repository"). The **Vercel GitHub App isn't authorized on the repo** — CLI can't grant it. **Needs user action** (see Next Steps).
6. **gstack `make-pdf` binary not built.** **Fix:** rendered the branded PDFs via headless Google Chrome (`--headless --print-to-pdf` on hand-authored HTML).
7. **Merge to `main` initially blocked** by the safety classifier (vague "yes do it"). **Fix:** required the user's explicit "merge PR #1 to main."

---

## Next Step (what I'd do next)

**Immediate (needs user account grants — can't be done via CLI):**
1. **Connect Supabase** (user said "later"): create a Supabase project → paste `supabase/migrations/0001_init.sql` in its SQL editor → add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in Vercel → redeploy. Then `/#staff` becomes a real sign-in with per-restaurant data (sign-up auto-bootstraps a Cinematic subscription via `ensureBillingForUser`). Steps: `docs/DEPLOY-STEPS.md`.
2. **Auto-deploy on push:** authorize the Vercel GitHub App on the repo (Vercel → project → Settings → Git → Connect), so pushes to `main` redeploy. Then I can finish `vercel git connect`.

**Then (production hardening — code work):**
3. Make signup bootstrap (`ensureBillingForUser`) and the usage increment (`api/usage/track.ts`) **atomic** via Postgres `SECURITY DEFINER` RPCs instead of multi-statement read-then-write.
4. Wire a **real CDN → `api/usage/track`** feed (Cloudflare/Bunny logs) so `video_screens.bytes_served` reflects actual egress; today demo shows a per-package mock.
5. **Razorpay live test** under `vercel dev` with test keys; confirm webhook → invoice `paid` round-trips (the webhook writes `invoices.paid_at`, which the migration adds).

**Verification before calling it done:** `npm run build` green (CI enforces), `/#staff` billing flows work in demo, and once Supabase is on: sign-in → billing loads from DB → change plan / renew persist.

---

## Pointers
- Deploy runbook: `docs/DEPLOY-STEPS.md` · backend gate explained: `docs/DEPLOYMENT.md`
- Commercial/pricing rationale: `commercial/PLAN.md`, `commercial/RESEARCH.md`
- Pricing as code: `src/console/lib/billing.ts`
