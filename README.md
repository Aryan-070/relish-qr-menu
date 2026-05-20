# Relish — International Veg Cuisine · QR Menu

A premium digital QR menu built as a mobile-first React SPA. Customers scan a table QR code and get a cinematic, luxury booklet experience rather than a static PDF.

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
| **Waiter Panel** | Bell ring, gold ripple, 5 quick-tap service options |
| **Order Panel** | Full cart — quantities, notes, total |

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript 5 + Vite 5 |
| Animations | Framer Motion v11 + GSAP 3.14.2 (HyperFrames composition) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Fonts | Playfair Display · Inter · Cormorant Garamond · Caveat |
| Data | Static TypeScript (no backend, no API) |

---

## Documentation

| File | What it covers |
|------|---------------|
| [`TEAM_GUIDE.md`](./TEAM_GUIDE.md) | **Start here.** Complete guide — vision, every file explained, what we tried and failed, known issues, full roadmap, media production workflow |
| [`HANDOFF.md`](./HANDOFF.md) | Session-level handoff — current state snapshot, files actively edited, immediate next steps |

---

## Build & Deploy

```bash
npm run build     # → dist/
npm run preview   # serve dist/ locally
```

Deploy by dragging `dist/` into [Netlify](https://netlify.com), running `vercel deploy`, or setting up GitHub Pages via Actions.

---

## Media (future)

The landing background is currently an animated GSAP/HyperFrames composition.
When the Kling AI video is ready, drop it in `public/assets/hero-reel.mp4` and set
`HERO_VIDEO_SRC` in `src/screens/LandingCover.tsx` — the priority logic swaps it in automatically.
See `TEAM_GUIDE.md § 15` for the full Nano Banana + Kling AI workflow and prompts.
