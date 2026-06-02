# Deploy Steps — Relish QR Menu

A copy-pasteable runbook to get this app live. No prior experience required — follow it
top to bottom. The app is a **Vite single-page app** that deploys and runs as a
**no-backend demo with zero secrets**. Supabase (auth + data) and Razorpay (real
payments) are **optional add-ons** you can switch on later.

> For *why* things work the way they do (the demo/Supabase gate, the serverless
> functions), see the reference doc [`DEPLOYMENT.md`](./DEPLOYMENT.md). This file is the
> click-by-click how.

Repo: <https://github.com/Aryan-070/relish-qr-menu> (public) · default branch `main` ·
current work on branch `feat/staff-console` (PR #1 open).

---

## 1. Deploy in 2 minutes (no backend)

Any **one** of the three options below puts the full demo online — no keys, no database,
nothing to configure. Pick whichever you like.

After any of them you get a live URL like `https://relish-qr-menu-xxxx.vercel.app`.
- The customer menu is at the root: `https://…vercel.app/`
- The **Staff Console** is at: `https://…vercel.app/#staff` (note the `#staff` on the end)

### Option a — One-click "Deploy to Vercel" button (easiest)

1. Open the repo's **README** on GitHub: <https://github.com/Aryan-070/relish-qr-menu>.
   Near the top you'll see a **"Deploy to Vercel"** button — click it.
2. Vercel opens the **Create Project** flow. Sign in with GitHub if prompted, and let it
   **Clone** the repo to your account when it asks.
3. If it shows **Environment Variables** prompts (`VITE_SUPABASE_URL`, etc.), **leave them
   all blank** — blank = the zero-secrets demo. Click **Deploy**.
4. Wait for the build to finish (~1 min). Click **Visit** / **Continue to Dashboard** to get
   your `*.vercel.app` URL.
5. Open `<your-url>/#staff` to see the Staff Console.

### Option b — Vercel dashboard, Git import

1. Go to <https://vercel.com> and sign in (GitHub login is simplest).
2. Click **Add New… → Project**.
3. Under **Import Git Repository**, find and **Import** `Aryan-070/relish-qr-menu`.
   (If you don't see it, click **Adjust GitHub App Permissions** / **Import Third-Party Git
   Repository** and paste the repo URL.)
4. Vercel **auto-detects Vite** — the settings come straight from `vercel.json`
   (framework `vite`, build `npm run build`, output `dist`). **Don't change anything.**
5. Leave Environment Variables blank (demo mode). Click **Deploy**.

> **Deploying the PR branch before it's merged.** The default branch is `main`; PR #1
> (`feat/staff-console`) is still open. To get that branch live, choose one:
> - **Merge first (recommended):** merge PR #1 into `main`, then Vercel's Production
>   deploy serves it. On GitHub: open PR #1 → **Merge pull request** → **Confirm merge**.
> - **Preview deploy:** every push to `feat/staff-console` gets its own **Preview** URL in
>   the Vercel dashboard (**Deployments** tab) — open that preview URL to test the branch.
> - **Switch Production Branch:** Vercel → Project → **Settings → Git → Production Branch**
>   → set it to `feat/staff-console` → redeploy.

### Option c — Vercel CLI (the `vercel` CLI is already installed)

Run these from the **repo root**
(`/Users/aryanshah/Downloads/softwares/Python_Django/Automations/claude_menu`):

```bash
vercel login      # one-time, interactive — pick your login method, confirm the email
vercel link       # links this folder to a Vercel project (accept the defaults it offers)
vercel --prod     # builds and ships a production deploy; prints your live URL
```

> The first `vercel` command asks a few setup questions (scope, "link to existing
> project?", project name, settings). **Press Enter to accept each default** — they match
> `vercel.json`. When `vercel --prod` finishes it prints the production URL; open
> `<that-url>/#staff` for the console.

---

## 2. Turn on the backend (Supabase auth + real billing)

This switches the Staff Console from the open demo to **real sign-in**, with each
restaurant's data stored in Postgres. Skip this entire section if the demo is all you need.

1. **Create a Supabase project.** Go to <https://supabase.com> → **New project**. Give it a
   name and a database password (save the password somewhere safe). Wait for it to finish
   provisioning (~2 min).
2. **Apply the database schema.**
   - In the Supabase dashboard sidebar, open **SQL Editor → New query**.
   - Open the file [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
     in this repo, **copy its entire contents**, paste into the SQL editor, and click **Run**.
   - You should see "Success. No rows returned." That created the tables, types, and RLS
     policies.
   - *(Alternative, if you install the Supabase CLI: run `supabase db push` from the repo
     root instead.)*
3. **Configure email auth.** Sidebar → **Authentication → Providers**. Keep **Email**
   turned **on**. For quick demos, expand Email and turn **OFF** "**Confirm email**" so a
   new sign-up is logged in immediately (no inbox round-trip).
4. **Copy your keys.** Sidebar → **Project Settings → API**. Copy two values:
   - **Project URL** (e.g. `https://abcdxyz.supabase.co`)
   - **anon public** key (the long `eyJ…` string under *Project API keys*)
5. **Add the keys to Vercel.** Vercel → your Project → **Settings → Environment
   Variables**. Add these two (apply them to **Production**, **Preview**, and
   **Development**):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL from step 4 |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key from step 4 |

6. **Redeploy.** Vercel → **Deployments** → on the latest deployment click the **⋯** menu →
   **Redeploy** (env-var changes only take effect on a fresh build).

**Result:** the Staff Console (`/#staff`) now shows a **sign-in screen**. Signing up
creates the restaurant row and **seeds a Cinematic subscription automatically**, so the
Billing tab has data to show. "Exit to menu" signs the user out.

---

## 3. Service-role key for the serverless functions

Only needed if you want the **Razorpay webhook** to mark invoices paid, or the
**video-usage** endpoint to record egress. The two `VITE_…` keys from Section 2 do **not**
cover this — those functions need elevated (service-role) access that must never reach the
browser.

1. Supabase → **Project Settings → API** → copy:
   - **Project URL** (same as before)
   - **`service_role`** key (under *Project API keys* — it's marked *secret*; treat it like a
     password)
2. Vercel → Project → **Settings → Environment Variables** → add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` secret key |

3. **Redeploy** (Deployments → ⋯ → Redeploy).

> ⚠️ **Never** prefix these with `VITE_`. Anything starting with `VITE_` is baked into the
> public browser bundle — prefixing the service-role key would leak full database access.

---

## 4. Razorpay (optional — real payments)

Powers the subscription-renewal payment flow. It is **inert until keys are set**: with no
keys, the Billing dashboard just uses a demo "mark paid" button and nothing else changes.

1. **Get your keys** from the Razorpay Dashboard → **Settings → API Keys** (and the webhook
   secret you'll set in step 3):

   | Name | Scope | Where to get it |
   |---|---|---|
   | `VITE_RAZORPAY_KEY_ID` | **client** (shipped to browser) | Razorpay → Settings → API Keys → **Key Id** |
   | `RAZORPAY_KEY_ID` | **server** | the same Key Id (server copy) |
   | `RAZORPAY_KEY_SECRET` | **server** | Razorpay → Settings → API Keys → **Key Secret** |
   | `RAZORPAY_WEBHOOK_SECRET` | **server** | the secret you choose when creating the webhook (step 3) |

   Add all four in Vercel → **Settings → Environment Variables**, then **Redeploy**.
   You also need the Section 3 vars (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) for the
   webhook to write the "paid" status back to the database.

   > ⚠️ Only `VITE_RAZORPAY_KEY_ID` is client-side. **Never** prefix the others with `VITE_`.

2. **Register the webhook.** Razorpay → **Settings → Webhooks → Add New Webhook**:
   - **URL:** `https://<your-deployment>.vercel.app/api/razorpay/webhook`
   - **Secret:** the exact value you used for `RAZORPAY_WEBHOOK_SECRET`
   - **Active events:** check **`payment.captured`** and **`order.paid`**
   - Save.

3. **Note on local testing.** The `api/…` functions do **not** run under the plain Vite dev
   server (`npm run dev`). They run only on a real Vercel deploy, or locally via:

   ```bash
   vercel dev   # serves the Vite app AND the api/ functions together
   ```

---

## 5. Environment variable matrix

| Variable | Scope | Required for | Where to get it |
|---|---|---|---|
| `VITE_SUPABASE_URL` | client | Real sign-in + stored data (Section 2) | Supabase → Project Settings → API → **Project URL** |
| `VITE_SUPABASE_ANON_KEY` | client | Real sign-in + stored data (Section 2) | Supabase → Project Settings → API → **anon public** |
| `SUPABASE_URL` | server | Webhook + usage functions (Section 3) | Supabase → Project Settings → API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Webhook + usage functions (Section 3) | Supabase → Project Settings → API → **service_role** |
| `VITE_RAZORPAY_KEY_ID` | client | Razorpay checkout in the browser (Section 4) | Razorpay → Settings → API Keys → **Key Id** |
| `RAZORPAY_KEY_ID` | server | Creating Razorpay orders (Section 4) | Razorpay → Settings → API Keys → **Key Id** |
| `RAZORPAY_KEY_SECRET` | server | Creating Razorpay orders (Section 4) | Razorpay → Settings → API Keys → **Key Secret** |
| `RAZORPAY_WEBHOOK_SECRET` | server | Verifying webhook calls (Section 4) | The secret you set on the webhook |

- **client** = prefixed `VITE_`, inlined into the public browser bundle. Only put
  publishable values here.
- **server** = read only by the Vercel functions under `api/`. **Never** prefix with `VITE_`.
- **Nothing in this table is required for the demo** (Section 1). Add rows only as you turn
  features on.

---

## 6. Verify checklist

After deploying, open your live URL and confirm:

- [ ] **`/`** loads the customer menu (hero, sections, dishes).
- [ ] **`/#staff`** opens the Staff Console.
  - **Demo mode** (no Supabase vars): a **role switcher** lets you jump between
    admin / manager / waiter — no sign-in.
  - **Supabase mode** (vars set + redeployed): you get a **sign-in screen**; sign up to
    create your restaurant.
- [ ] The **Billing** tab shows **packages and invoices** (Supabase mode seeds a Cinematic
      subscription on sign-up).
- [ ] **Change plan** and **Renew** actions work (demo: instant "mark paid"; Razorpay
      configured: opens the Razorpay checkout modal).

If `/#staff` shows a sign-in screen when you expected the demo role switcher, the Supabase
vars are set — clear them (or check you meant to enable auth) and redeploy.
