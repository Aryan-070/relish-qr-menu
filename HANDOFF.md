# Relish QR Menu — Session Handoff

_Last updated: 2026-05-20 · Classic variant landing page + HyperFrames full-screen background_

---

## Goal

Build **Relish — International Veg Cuisine**, a premium digital QR menu as a mobile-first SPA.
The landing page should feel like opening a luxury booklet — a cinematic full-screen animation
plays as the background (candlelight → plate reveal → RELISH reveal with floating spices),
then the user taps through to the full menu, AI recommendation flow, or waiter call.

The full 8-screen spec is in the archived plan file:
`~/.claude/plans/fetch-this-design-file-warm-nygaard.md`

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Build | Vite 5 + React 18 + TypeScript 5 | `npm run dev` → localhost:5173 |
| Routing | React state machine (no React Router) | `Screen = 'cover' \| 'menu' \| 'recommend'` |
| Animations | Framer Motion v11 | `AnimatePresence` + `motion.*` |
| Background composition | HyperFrames (GSAP 3.14.2 HTML) | `public/assets/hero-reel.html` |
| Styling | Tailwind CSS v3 + CSS custom properties | `src/tokens.css`, `src/index.css` |
| Fonts | Playfair Display, Inter, Cormorant Garamond, Caveat | Loaded via `<link>` in `index.html` |

**Design tokens** (in `src/tokens.css`):
```
--paper: #FFF8EA    --paper-2: #F7EBD2
--ink: #2A1E1E      --ink-soft: #5b4a44
--maroon: #8B1024   --red: #D71920
--gold: #D9A03A     --olive: #4F7A3C
--mute: #a89a8a
```

---

## Current State of the Code

### What is COMPLETE and working ✅

**App shell (`src/App.tsx`)**
- State machine: `cover → menu → recommend`
- 4 landing variants switchable in-app: Classic, Deco (Gastronomique), Editorial, Botanica
- `ItemDetail`, `AddToOrder`, `WaiterPanel`, `OrderPanel` all rendered outside `AnimatePresence` (correct)
- `useOrder` hook wires cart state throughout

**All 4 landing variants**
- `LandingCover.tsx` (Classic) — HyperFrames cinematic full-screen background
- `LandingGastronomique.tsx` (Deco)
- `LandingEditorial.tsx` (Editorial)
- `LandingBotanica.tsx` (Botanica)
- All 3 non-classic variants use the original paper-background layout (unaffected by this session's changes)

**HyperFrames composition (`public/assets/hero-reel.html`)**
- 3 scenes, 7.5s total, loops via `onComplete: () => tl.restart()`
- Scene 1: Candlelight — dark field, amber + maroon bokeh, ghost "R", dust particles, corner marks
- Scene 2: The Plate — warm ember BG, plate SVG springs in, sauce stroke draws, herb garnish, steam wisps, sauce dots
- Scene 3: RELISH Reveal — dark velvet, 3D letter tumble, gold underline draw, subtitle, then 8 ingredient silhouettes float upward (star anise, chili, oil bottle, bay leaf, garlic, cardamom, cinnamon, peppercorn trio)
- Loop resets: all `tl.set()` calls at `t=0` restore every element to initial state
- Auto-play fallback: `if (typeof window.__hyperframes === 'undefined') { tl.play(); }` — works in plain `<iframe>` without the HyperFrames player
- Verified working: timeline plays, loops, ingredients animate (opacity 0.20, drift transform confirmed at `t=5.2s`)

**LandingCover.tsx — full-screen layout (THIS SESSION'S MAIN CHANGE)**
- `iframe` is `position: absolute; inset: 0; z-index: 0` — fills the entire viewport
- Dark gradient vignette `height: 64%; z-index: 10` covers bottom portion for text legibility
- `flex-1` spacer (minHeight: 36vh) pushes React content to the bottom
- React overlay `z-index: 20`: tagline + trust badges + 3 animated buttons
- `CoverBackground` Three.js canvas **removed** (composition owns the background)
- React RELISH letter-by-letter heading **removed** (composition reveals it cinematically)
- GhostBtn: color `rgba(255,248,234,0.52)`, border `rgba(255,248,234,0.18)` — adapted for dark bg
- GoldBtn: color `#D9A03A` — adapted for dark bg
- Media priority: `HERO_VIDEO_SRC` (Kling AI .mp4) → `HERO_HTML_SRC` (HyperFrames) → CSS fallback

**Menu screens (all complete)**
- `MenuBooklet.tsx` — tab shell with TopBar, CategoryNav, BottomNav
- `CategoryPage.tsx` — per-category items with ambient animations
- `RecommendationFlow.tsx` — 3-step mood/size/budget chips, `useRecommendation` scoring
- `ItemDetail.tsx` — bottom sheet, drag-to-dismiss
- `AddToOrder.tsx` — order slip animation with checkmark
- `WaiterPanel.tsx` — bell SVG, ripple, 5 quick-tap options
- `OrderPanel.tsx` — full cart view

**Data & hooks**
- `src/data/menu.ts` — 5 categories × 6–8 items (Beverages, Soups, Quick Bites, Italian Fiesta, Desserts)
- `src/hooks/useRecommendation.ts` — client-side scoring by mood/partySize/budget
- `src/hooks/useOrder.ts` — cart state (add/remove/qty/note)

**Animation components**
- `BubblesAnim`, `SteamAnim`, `DrizzleAnim`, `BellRipple`, `PlateAnim`, `SwirlAnim` — CSS/SVG keyframe animations

---

## Files Actively Edited This Session

| File | Change |
|------|--------|
| `public/assets/hero-reel.html` | Full rewrite — v1 was 375×210px, 4s, 3 scenes. v2 is 100% responsive, 7.5s, full-frame, + 8 ingredient SVGs in Scene 3 |
| `src/screens/LandingCover.tsx` | Full restructure — removed height-constrained hero box, added full-screen iframe background, dark gradient overlay, flex spacer, adapted button colors for dark bg, removed CoverBackground + React RELISH heading |

---

## What Was Tried and Failed

### `repeat: -1` for ingredient loop
Tried using GSAP `repeat: -1` on ingredient drift tweens. **Banned by HyperFrames** — infinite-repeat timelines break the capture engine. Fixed by using finite `repeat: 0` (single drift) + calculating the exact motion to cover the available window (4.35s → 6.80s).

### `tl.from()` for Scene 3 RELISH letters
Tried `tl.from('#s3-l0', { opacity: 0, rotateX: -52, y: 18 })`. Works in standalone but breaks on loop restart — the `from()` records the animated-to state as the new base, so on loop restart the letters jump to wrong positions. **Fixed** by using `tl.set()` at `t=0` to force initial state, then `tl.to()` to animate to the final state. This pattern is loop-safe.

### Stroke-dashoffset losing state on loop
SVG sauce path and gold rules weren't resetting their dashoffset on loop restart. **Fixed** by adding explicit `tl.set('#s2-sauce', { attr: { 'stroke-dashoffset': 138, 'stroke-dasharray': 138 } }, 0)` and similar for all `#s3-*-line` elements.

### Three.js canvas as landing background
Original plan used a `CoverBackground.tsx` Three.js canvas with 30 floating gold/maroon particles. This was replaced by the HyperFrames composition because:
1. The composition provides far richer cinematics (3 actual scenes vs floating dots)
2. One less WebGL context
3. HyperFrames composition is also the path to Kling AI video swap — same `<iframe>/<video>` slot

### Constrained 210px hero box
The original `LandingCover.tsx` rendered the composition inside a `height: 210` `<div>` with rounded corners at the top — user wanted full page coverage. Removed entirely in this session.

### iframe with `min-h-dvh` on html/body
Early attempt at full-screen had `min-h-dvh` on the iframe's internal HTML — this caused the iframe document to be taller than its container, showing a scrollbar in some browsers. **Fixed** by setting `html, body { width: 100%; height: 100%; overflow: hidden; }` inside the composition — the iframe container clips it.

---

## Next Steps

### Immediate — visual polish

1. **Ingredient visibility** — The React dark gradient (bottom 64%) fully occludes ingredients at `y > 500px` (oil bottle, bay leaf escape partially; others are hidden). Consider:
   - Reduce gradient height to 55% (`height: '55%'`) and shift spacer to `minHeight: '42vh'` — more composition visible, buttons still have dark backing
   - OR increase ingredient drift distance so more reach the semi-transparent zone: anise `y: -200`, chili `y: -220`, etc.

2. **Scene 1 timing feels fast on first load** — fonts (Playfair Display) load async; the first loop may show fallback serif on Scene 3 RELISH letters. Add `document.fonts.ready.then(() => tl.play())` in hero-reel.html instead of the current immediate `tl.play()`.

3. **"Est. 2018" and composition corner marks overlap React corner ornaments** — both appear in the same screen corners. Either remove the React corner SVGs for the Classic variant (they live in `LandingCover.tsx` at the bottom of the return) or adjust the composition's corner mark positions from `3%` to `2%`.

### Near-term — Kling AI video integration

When the Kling AI `.mp4` is ready:
1. Drop `hero-reel.mp4` into `public/assets/`
2. Drop `hero-poster.jpg` (Nano Banana end-frame) into `public/assets/`
3. In `LandingCover.tsx`, set:
   ```ts
   const HERO_VIDEO_SRC = '/assets/hero-reel.mp4'
   const HERO_POSTER_SRC = '/assets/hero-poster.jpg'
   ```
4. The existing priority logic `HERO_VIDEO_SRC ? <video> : HERO_HTML_SRC ? <iframe> : <css>` handles the swap automatically — no other code changes needed.

**Nano Banana start-frame prompt** (written last session):
> "A single elegant white ceramic plate on a dark restaurant table, shot from slightly above at 20°, surrounded by scattered spices — star anise, cardamom, a cinnamon stick — on a surface of deep maroon and black. The plate is empty with a faint gold rim. Warm candlelight from the left casts a soft amber glow. Photorealistic, editorial food photography, shallow depth of field, black background."

**Kling AI video prompt** (written last session):
> "Slow cinematic push into the plate from above. The candlelight flickers gently. Aromatic spices drift upward — star anise, cardamom, chili. A sauce stroke appears on the plate. Then the spices dissolve into the word RELISH glowing in cream gold, letter by letter, as the camera pulls back to reveal the full scene. Duration 4 seconds, 24fps, film grain, luxury restaurant aesthetic."

### Medium-term — screens not yet built / wired

- `LandingGastronomique`, `LandingEditorial`, `LandingBotanica` — these three variants don't have the HyperFrames composition background. If we want all 4 to have the same cinematic feel, either add the iframe background to each or create variant-specific compositions.
- `CategoryPage` ambient animations (BubblesAnim for Beverages, SteamAnim for Soups, etc.) are built but need visual QA across all 5 categories.
- `ItemDetail` bottom sheet: drag-to-dismiss `dragConstraints` may need tuning on tall items.
- `OrderPanel` — built but needs a "Send Order" confirmation state.

### HyperFrames composition improvements (hero-reel.html)

- **Scene 2 steam animation**: The steam SVG paths are static opacity fade-in. They should animate upward (translateY) using a finite GSAP repeat — currently there's no motion on the steam wisps, just an opacity reveal.
  ```js
  // Add after steam opacity tween:
  tl.to('#s2-steam', { y: -18, duration: 1.2, ease: 'sine.inOut', repeat: 2, yoyo: true }, 2.10);
  ```
- **Scene 1 ghost "R"**: It fades in but never animates. A subtle scale oscillation (1.0 → 1.02 → 1.0) over 2s would add breath to the candlelight scene.
- **More ingredients**: Add turmeric powder (SVG dust cloud), a sprig of thyme/rosemary. Position toward left-center for balance (currently more items on the right half).

---

## Key Technical Gotchas

```
HyperFrames loop pattern (NO repeat: -1):
  tl = gsap.timeline({ paused: true, onComplete: () => tl.restart() })
  tl.set(everything, { initial state }, 0)   ← MANDATORY loop resets at t=0
  // ... all animation tweens ...
  window.__timelines['relish-hero'] = tl
  if (typeof window.__hyperframes === 'undefined') { tl.play() }

SVG attr animation (opacity, stroke-dashoffset):
  tl.to('#el', { attr: { 'stroke-dashoffset': 0 } })   ← use attr:{} wrapper
  tl.to('#el', { attr: { opacity: 1 } })                ← NOT just opacity: 1

Letter loop-safe pattern:
  tl.set('#letter', { opacity: 0, rotateX: -52, y: 18 }, 0)   ← set initial at t=0
  tl.to('#letter',  { opacity: 1, rotateX:  0, y:  0 }, 3.4)  ← animate to final
  (NOT tl.from — from() breaks on restart)

iframe same-origin timeline access (for debugging):
  document.querySelector('iframe[title="Relish hero animation"]')
    ?.contentWindow?.__timelines?.['relish-hero']?.time()
```

---

## Dev Commands

```bash
cd /Users/aryanshah/Downloads/softwares/Python_Django/Automations/claude_menu

npm run dev          # localhost:5173
npm run build        # dist/
npm run preview      # serve dist/
```

The preview MCP server ID is `6d172b01-ba0a-45a2-b162-cab4e2dcbda9` (may change between sessions — use `preview_list` to get the current ID).
