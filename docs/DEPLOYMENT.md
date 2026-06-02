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
- **Done (6.1 foundation):** Supabase client, auth context, sign-in screen, console auth gate, SQL schema + RLS, Vercel config.
- **Next:** wire the Billing dashboard (`src/console/views/BillingView.tsx`) to the `subscriptions`/`invoices` tables, map `app_users.role` to console role, add Razorpay Subscriptions (6.2), and video-egress metering (6.4). See [`/commercial/PLAN.md`](../commercial/PLAN.md) Phase 6.
