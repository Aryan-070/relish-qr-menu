# Deployment

Relish is a Vite + React single-page app. It deploys to Vercel as a static site and runs as a **localStorage demo** with no backend. Adding two Supabase env vars switches on real auth and (in future phases) real data.

## 1. Deploy to Vercel

The repo includes [`vercel.json`](../vercel.json) (framework `vite`, build `npm run build`, output `dist`, SPA rewrite to `index.html`).

### Option A — Git import (recommended)
1. Push the repo to GitHub/GitLab/Bitbucket.
2. In Vercel → **Add New → Project** → import the repo.
3. Vercel auto-detects Vite. Keep the defaults (they match `vercel.json`).
4. **Deploy.** You get a live URL serving the full demo (no secrets needed).

### Option B — CLI
```bash
npm i -g vercel
vercel        # preview deploy
vercel --prod # production deploy
```

> The video renditions in `public/assets/video/` are git-ignored (~120MB). The app falls back to poster images when they're absent, so the deploy works without them. To ship video, host the clips on a CDN (Cloudflare R2 / Bunny — see [pricing-and-economics](commercial/pricing-and-economics.md)) and point the manifest at those URLs.

## 2. Connect Supabase (optional — enables real auth)

Without these vars the app runs in **demo mode** (no login, localStorage data). With them, the Staff Console requires sign-in.

### a. Create the project & schema
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the schema in [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql):
   - **Supabase CLI:** `supabase db push`, or
   - **SQL editor:** paste the file and run it.
3. (Auth) In **Authentication → Providers**, keep Email enabled. For demos you can turn off "Confirm email" so sign-up logs in immediately.

### b. Set env vars
Copy [`.env.example`](../.env.example) → `.env.local` for local dev, and set the same two in **Vercel → Project → Settings → Environment Variables**:

| Var | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

Redeploy after setting them. The console now shows a sign-in screen; "Exit to menu" signs the user out.

## How the gate works
- [`src/lib/supabase.ts`](../src/lib/supabase.ts) — creates the client only when both vars are present (`isSupabaseConfigured`).
- [`src/console/auth/AuthContext.tsx`](../src/console/auth/AuthContext.tsx) — `mode: 'demo' | 'supabase'`, session handling, sign-in/up/out.
- [`src/console/ConsoleApp.tsx`](../src/console/ConsoleApp.tsx) — gates the console behind `<SignIn />` in Supabase mode; demo mode falls straight through.

## What's done vs. next (Phase 6)
- **Done (6.1):** Supabase client, auth context, sign-in screen, console auth gate, SQL schema + RLS, Vercel config.
- **Done (6.2):** Billing dashboard wired to `subscriptions`/`invoices` via `billingRepo` + `useBilling`; Razorpay renewal flow (`api/razorpay/*`) incl. webhook → Supabase invoice update; `app_users.role` drives the console role in Supabase mode.
- **Done (6.4):** video-egress metering — `api/usage/track` ingestion + Video usage panel reading `video_screens`.
- **Next:** production hardening — atomic bootstrap/increment via Postgres RPCs, a real CDN→`api/usage/track` feed, and Razorpay live-key testing under `vercel dev`. See [`/commercial/PLAN.md`](../commercial/PLAN.md) Phase 6.

## 3. Connect Razorpay (optional — real payments)

Razorpay powers the subscription-renewal payment flow. It is **completely inert until keys are set** — with no keys, the Billing dashboard falls back to the demo "mark paid" action, the app still builds and deploys, and no Razorpay code path runs.

Because Razorpay needs a secret key, the secret-bearing work lives in **Vercel serverless functions** under [`api/razorpay/`](../api/razorpay), not in the browser bundle. Only the publishable key id is exposed to the client.

### a. Set env vars

| Var | Scope | Where to find it |
|---|---|---|
| `VITE_RAZORPAY_KEY_ID` | **Frontend** (client-exposed) | Razorpay → Settings → API Keys → Key Id |
| `RAZORPAY_KEY_ID` | Serverless function (`api/`) | same Key Id (server copy) |
| `RAZORPAY_KEY_SECRET` | Serverless function (`api/`) | Razorpay → Settings → API Keys → Key Secret |
| `RAZORPAY_WEBHOOK_SECRET` | Serverless function (`api/`) | Razorpay → Settings → Webhooks → the secret you set when creating the webhook |

`VITE_RAZORPAY_KEY_ID` is the **only** variable shipped to the client (anything prefixed `VITE_` is inlined into the bundle). Never prefix the secret or webhook vars with `VITE_`. Set all four in **Vercel → Project → Settings → Environment Variables** (and in `.env.local` for local dev — see [`.env.example`](../.env.example)).

### b. Run the functions locally

The functions in `api/` do **not** run under the plain Vite dev server. Use the Vercel CLI so `/api/razorpay/*` is served:

```bash
npm i -g vercel
vercel dev   # serves the Vite app AND the api/ functions together
```

### c. Register the webhook

In **Razorpay → Settings → Webhooks → Add New Webhook**:

- **URL:** `https://<your-deployment>.vercel.app/api/razorpay/webhook`
- **Secret:** the value you set as `RAZORPAY_WEBHOOK_SECRET`
- **Active events:** `payment.captured` and `order.paid`

The webhook handler verifies the `x-razorpay-signature` header (HMAC-SHA256 over the raw body) and, on a valid `payment.captured` / `order.paid` event, marks the matching invoice paid in Supabase (looked up by the order receipt / `notes.invoiceId`). This DB write uses a **service-role** client, so set these two server-only vars as well (never prefix with `VITE_`):

| Var | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |

If those are unset the webhook still returns `200` on a valid signature but skips the DB write.

### d. Video-egress metering (Phase 6.4)

[`api/usage/track.ts`](../api/usage/track.ts) is a POST endpoint a CDN worker/cron calls with `{ restaurantId, screenId, bytes }` to increment `video_screens.bytes_served`. It uses the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. The **Video usage** panel on the Billing dashboard reads those rows (demo mode shows a per-package mock).

### How the flow works
- [`src/console/lib/razorpay.ts`](../src/console/lib/razorpay.ts) — `isRazorpayConfigured` gates the UI; `startRenewalPayment(...)` creates an order via the function, lazy-loads Razorpay Checkout, and opens the modal.
- [`api/razorpay/create-order.ts`](../api/razorpay/create-order.ts) — creates the Razorpay order with Basic auth (`501` if env missing).
- [`api/razorpay/webhook.ts`](../api/razorpay/webhook.ts) — verifies signatures and (TODO) marks invoices paid.
