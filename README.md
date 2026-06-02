# Relish — International Veg Cuisine · QR Menu

A premium digital QR menu built as a mobile-first React SPA. Customers scan a table QR code and get a cinematic, luxury booklet experience rather than a static PDF. Now also ships a role-based **Staff Console** with a **Billing & Subscription** dashboard and an optional **Supabase auth + Razorpay** backend (the app runs as a no-backend demo until those keys are set).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAryan-070%2Frelish-qr-menu&env=VITE_SUPABASE_URL,VITE_SUPABASE_ANON_KEY&envDescription=Optional%20%E2%80%94%20leave%20blank%20to%20run%20the%20no-backend%20demo&project-name=relish-qr-menu&repository-name=relish-qr-menu)

> One click deploys the full demo (no secrets). Open the deployed `/#staff` for the Staff Console. To enable real auth/billing, add the env vars — see [`docs/DEPLOY-STEPS.md`](./docs/DEPLOY-STEPS.md).

---

## Quick Start

```bash
git clone https://github.com/Aryan-070/relish-qr-menu.git
cd relish-qr-menu
npm install
npm run dev
# → localhost:5173
```

Open Chrome DevTools → Device toolbar → iPhone 14 Pro (393 × 852) for the intended viewport.

---

## What's Inside

| Screen | Description |
|--------|-------------|
| **Landing** (4 variants) | Classic: cinematic HyperFrames/GSAP composition full-screen background — candlelight → plate reveal → RELISH + floating spices. Also: Deco, Editorial, Botanica variants. |
| **Menu Booklet** | Category tabs, item cards, per-section ambient animations |
| **AI Recommendations** | 3-question mood / party size / budget → client-side scored top 3 dishes |
| **Item Detail** | Bottom sheet, drag-to-dismiss, customizations, pairings |
| **Add to Order** | Animated order slip with spring-bounce item placement |
| **Service Panel** | Full tableside hub — call waiter (animated approach), water, bill split, Jain info, live request feed |
| **Order Panel** | Full cart — quantities, notes, total |

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript 5 + Vite 5 |
| Animations | Framer Motion v11 + GSAP 3.14.2 (HyperFrames composition) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Fonts | Playfair Display · Inter · Cormorant Garamond · Caveat |
| Data | Static TypeScript demo by default; optional Supabase (auth + Postgres) and Razorpay (billing) backend |
| Back-office | Role-based Staff Console (`src/console/`) — dashboards, floor, menu CRUD, Billing & Subscription |

---

## Documentation

| File | What it covers |
|------|---------------|
| [`TEAM_GUIDE.md`](./TEAM_GUIDE.md) | **Start here.** Complete guide — vision, every file explained, what we tried and failed, known issues, full roadmap, media production workflow |
| [`HANDOFF.md`](./HANDOFF.md) | Session-level handoff — current state snapshot, files actively edited, immediate next steps |
| [`docs/DEPLOY-STEPS.md`](./docs/DEPLOY-STEPS.md) | Click-by-click: deploy to Vercel, connect Supabase + Razorpay |
| [`docs/`](./docs) | Deployment guide + commercial kit (brochure, pricing, comparison) |

---

## Build & Deploy

```bash
npm run build     # → dist/  (runs tsc -b && vite build)
npm run preview   # serve dist/ locally
```

Recommended host is **Vercel** (config in [`vercel.json`](./vercel.json)). Fastest path: the **Deploy with Vercel** button above, or import the repo at vercel.com. It ships as a no-backend demo with zero secrets; add `VITE_SUPABASE_*` to turn on real auth/billing.

- **Step-by-step runbook:** [`docs/DEPLOY-STEPS.md`](./docs/DEPLOY-STEPS.md)
- **How the backend gate works:** [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md)
- CI builds every push/PR via [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

## Media

All dish, cover, and banner images are **WebP** assets in `public/assets/`.
The landing background currently uses an animated GSAP/HyperFrames HTML composition (`hero-reel.html`).
Category pages have CSS/SVG ambient animations per section.

**Upgrading to Veo-generated videos (next step):**
1. Generate 6 videos using prompts in `public/assets/prompts/08-video-reels.md`
2. Drop `.mp4` files into `public/assets/`
3. Hero: set `HERO_VIDEO_SRC = '/assets/hero-reel.mp4'` in `LandingCover.tsx`
4. Category ambients: wire `<video>` tags in `CategoryPage.tsx` to replace SVG animations

See `HANDOFF.md` for exact CLI commands and wiring instructions.
