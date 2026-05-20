# Relish QR Menu — Complete Team Guide

> **Who this is for:** Any developer, designer, or contributor joining this project.
> This document covers everything — the vision, every technical decision, what we tried,
> what broke, what works, and exactly where to pick up.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Live Demo & Running Locally](#2-live-demo--running-locally)
3. [Architecture Overview](#3-architecture-overview)
4. [Design System](#4-design-system)
5. [File Structure — Every File Explained](#5-file-structure--every-file-explained)
6. [The HyperFrames Composition (hero-reel.html)](#6-the-hyperframes-composition-hero-reelhtml)
7. [The Landing Page (LandingCover)](#7-the-landing-page-landingcover)
8. [All 4 Landing Variants](#8-all-4-landing-variants)
9. [Menu Screens](#9-menu-screens)
10. [Data Layer](#10-data-layer)
11. [Animation System](#11-animation-system)
12. [What We Tried That Failed](#12-what-we-tried-that-failed)
13. [Known Issues & Rough Edges](#13-known-issues--rough-edges)
14. [Roadmap — What's Left to Build](#14-roadmap--whats-left-to-build)
15. [Media Production (Nano Banana + Kling AI)](#15-media-production-nano-banana--kling-ai)
16. [Key Technical Gotchas](#16-key-technical-gotchas)
17. [Contributing](#17-contributing)

---

## 1. Project Vision

**Relish — International Veg Cuisine** is a premium digital QR menu for a restaurant.
Customers scan a QR code at the table, and instead of a boring PDF or basic webpage, they get:

- A **cinematic landing page** that feels like opening a luxury booklet — a full-screen animation plays
  showing candlelight, a plate reveal, and the RELISH logo appearing letter by letter, with spices
  drifting through the air
- A **scrollable menu** organized by category with ambient animations per section
- An **AI recommendation flow** — tap "Recommend Something", answer 3 quick questions (mood,
  party size, budget), and get 3 scored dish recommendations
- A **call waiter button** accessible from anywhere in the app
- A **cart** where you can build your order and show it to the waiter

**The guiding aesthetic:** A luxury Indian-international vegetarian restaurant. Think editorial food
photography, Playfair Display headings, gold accents, deep maroon, candlelit atmosphere. Not a
startup-style menu — a *booklet* you'd be proud to hand a guest.

**No backend.** Fully static SPA. Menu data is hardcoded TypeScript. No API calls, no database,
no server. This means it's hostable on any static CDN (Vercel, Netlify, GitHub Pages).

---

## 2. Live Demo & Running Locally

### Prerequisites
- Node.js 20+
- npm 10+

### Setup
```bash
git clone https://github.com/Aryan-070/relish-qr-menu.git
cd relish-qr-menu
npm install
npm run dev
# → opens at http://localhost:5173
```

### Build for production
```bash
npm run build       # output → dist/
npm run preview     # serve the dist/ locally
```

### Mobile preview
Open Chrome DevTools → Toggle device toolbar → select iPhone 14 Pro (393×852) or similar.
Everything is designed for 375–430px width. On desktop it renders as a centered card.

---

## 3. Architecture Overview

```
User scans QR code
        ↓
React SPA loads (index.html → main.tsx → App.tsx)
        ↓
App.tsx — state machine
  screen: 'cover' | 'menu' | 'recommend'
  landingVariant: 'classic' | 'gastronomique' | 'editorial' | 'botanica'
        ↓
Landing (cover) ──────────────────────────────────────────────────────
  LandingCover (Classic)                                              │
    └─ <iframe src="/assets/hero-reel.html" />   ← HyperFrames GSAP  │
       Full-screen cinematic background                               │
    └─ React overlay (tagline + badges + 3 buttons)                  │
                                                                      │
  LandingGastronomique / LandingEditorial / LandingBotanica          │
    └─ Paper-background variants (no composition)                    │
        ↓
Menu (menu) ──────────────────────────────────────────────────────────
  MenuBooklet
    └─ TopBar + CategoryNav (horizontal scroll tabs)
    └─ CategoryPage (per-category item list + ambient animation)
    └─ BottomNav (Ask AI / Call Waiter / View Order)
    └─ ItemDetail (bottom sheet, tap any item to open)
        ↓
Recommend (recommend) ────────────────────────────────────────────────
  RecommendationFlow
    └─ 3 question steps → useRecommendation scoring → 3 result cards

Overlays (always mounted, shown/hidden by state):
  ItemDetail     — bottom sheet for any menu item
  AddToOrder     — order slip animation (item "lands" on slip)
  OrderPanel     — full cart view
  WaiterPanel    — call waiter with 5 quick-tap options
```

### No React Router

We deliberately chose a state machine over React Router. Reasons:
- Simpler — no URL concerns for a kiosk-style QR menu
- AnimatePresence wraps each screen transition cleanly
- Overlays (ItemDetail, WaiterPanel) live outside the router, preventing unmount issues

---

## 4. Design System

### Colors (`src/tokens.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--paper` | `#FFF8EA` | Main background (warm cream) |
| `--paper-2` | `#F7EBD2` | Secondary bg, card backgrounds |
| `--ink` | `#2A1E1E` | Primary text |
| `--ink-soft` | `#5b4a44` | Secondary text, labels |
| `--maroon` | `#8B1024` | Primary CTA, headings, logo color |
| `--red` | `#D71920` | Accent red |
| `--gold` | `#D9A03A` | Premium accents, borders, ornaments |
| `--olive` | `#4F7A3C` | Veg indicator, herb garnish |
| `--mute` | `#a89a8a` | Disabled states, muted text |

### Typography

| Font | Weight | Use |
|------|--------|-----|
| Playfair Display | 500, 700 | Hero headings, dish names, RELISH wordmark |
| Inter | 400, 500, 600 | UI text, prices, labels, buttons |
| Cormorant Garamond | 400 italic | Taglines, editorial descriptions |
| Caveat | 400, 700 | Decorative handwriting accents |

All fonts loaded via `<link>` in `index.html` from Google Fonts.

### Tailwind custom classes (`tailwind.config.js`)

```js
fontFamily: {
  playfair:  ['Playfair Display', 'Georgia', 'serif'],
  inter:     ['Inter', 'system-ui', 'sans-serif'],
  cormorant: ['Cormorant Garamond', 'Georgia', 'serif'],
  caveat:    ['Caveat', 'cursive'],
}
```

### Keyframe animations (`src/index.css`)

| Name | Used on | Effect |
|------|---------|--------|
| `shine-sweep` | PrimaryBtn | Shimmer highlight sweeps across button |
| `gold-pulse` | GoldBtn | Soft outward box-shadow pulse |
| `ghost-breathe` | GhostBtn | Subtle border opacity oscillation |
| `leaf-sway` | Botanica variant | Leaf illustration gentle rock |
| `deco-grow` | Gastronomique variant | Art deco rule line grows from center |

---

## 5. File Structure — Every File Explained

```
relish-qr-menu/
│
├── index.html                  Root HTML — Google Fonts links, #root mount point
├── vite.config.ts              Vite config — @vitejs/plugin-react
├── tailwind.config.js          Tailwind — fonts mapped, content paths
├── tsconfig.json               TypeScript — strict mode
├── package.json                All dependencies
│
├── public/
│   └── assets/
│       └── hero-reel.html      ★ HyperFrames cinematic composition (standalone HTML+GSAP)
│                               (Drop hero-reel.mp4 here when Kling AI is ready)
│
└── src/
    ├── main.tsx                Entry point — renders <App /> into #root
    ├── App.tsx                 ★ Root state machine — screens + variant switcher + overlays
    ├── App.css                 Global reset + app-shell styles
    ├── index.css               ★ Design tokens + keyframe animations
    ├── tokens.css              CSS custom properties (colors)
    │
    ├── data/
    │   └── menu.ts             ★ Complete mock menu — 5 categories × 6–8 items each
    │                           Type: MenuItem { id, name, price, description, isJain,
    │                           canBeJain, tags[], pairings, customizations[] }
    │
    ├── hooks/
    │   ├── useRecommendation.ts  AI scoring — pure client-side additive point algorithm
    │   │                         Input: mood + partySize + budget → ranked array of 3 paths
    │   └── useOrder.ts           Cart state — add/remove/qty/note/total/count
    │
    ├── animations/
    │   └── variants.ts         Framer Motion named variants:
    │                           fadeIn, fadeUp, stagger, slideLeft, slideRight,
    │                           bottomSheet, scaleIn, chipTap
    │
    ├── components/
    │   ├── atoms/
    │   │   ├── Button.tsx          Generic button atom
    │   │   ├── Chip.tsx            Selection chip (used in RecommendationFlow)
    │   │   ├── Badge.tsx           Small label badge
    │   │   ├── Price.tsx           Formatted price display
    │   │   └── CategoryIllustration.tsx  Per-category SVG header art
    │   │
    │   ├── molecules/
    │   │   ├── TopBar.tsx          Logo + category name + waiter bell
    │   │   ├── CategoryNav.tsx     Horizontal scroll pills — Beverages/Soups/etc.
    │   │   ├── MenuCard.tsx        Individual menu item card (image + name + price + tags)
    │   │   ├── BottomNav.tsx       Sticky bottom: Ask AI / Call Waiter / View Order
    │   │   └── ImagePlaceholder.tsx  Cream diagonal-stripe box (placeholder for food photos)
    │   │
    │   └── animations/
    │       ├── BubblesAnim.tsx     Beverages — 5 circles float upward, fade (CSS keyframe)
    │       ├── SteamAnim.tsx       Soups — SVG wavy path animates upward
    │       ├── DrizzleAnim.tsx     Desserts — SVG drizzle path draws downward
    │       ├── BellRipple.tsx      Waiter — bell ring + gold SVG ripple
    │       ├── PlateAnim.tsx       Quick Bites — border + scale reveal
    │       └── SwirlAnim.tsx       Italian — SVG spiral draws in
    │
    ├── three/
    │   └── CoverBackground.tsx   Three.js floating particle canvas (UNUSED — kept for reference)
    │                             Originally the landing bg, replaced by HyperFrames composition
    │
    └── screens/
        ├── LandingCover.tsx          ★★ Classic variant — full-screen HyperFrames background
        ├── LandingGastronomique.tsx  Deco / Art Nouveau variant — paper bg, ornate rules
        ├── LandingEditorial.tsx      Magazine / editorial variant — high contrast type
        ├── LandingBotanica.tsx       Botanical / nature variant — olive greens, leaf motifs
        ├── MenuBooklet.tsx           ★ Main menu shell
        ├── CategoryPage.tsx          Per-category view
        ├── RecommendationFlow.tsx    3-step AI recommendation
        ├── ItemDetail.tsx            Bottom sheet item detail
        ├── AddToOrder.tsx            Order confirmation animation
        ├── WaiterPanel.tsx           Call waiter overlay
        └── OrderPanel.tsx            Cart / order review
```

---

## 6. The HyperFrames Composition (hero-reel.html)

This is the most technically complex part of the project. Read this carefully.

### What it is

`public/assets/hero-reel.html` is a **standalone HTML file** that runs a 7.5-second looping
cinematic animation using GSAP 3.14.2. It's embedded in `LandingCover.tsx` as a full-screen
`<iframe>` behind the React content.

The HyperFrames framework is a video-composition system — compositions are HTML files with
`data-*` timing attributes and GSAP timelines registered as `window.__timelines`. We're using
it in standalone auto-play mode (without the full HyperFrames player).

### The three scenes

**Scene 1 — Candlelight (0.0–1.25s)**
- Deep charcoal background (`#0C0406`)
- Amber + maroon bokeh blobs fade in (blurred radial gradients)
- Oversized ghost "R" fades in (barely visible, textural)
- 6 dust particles: pop in, drift upward, fade out (shooting sparks)
- "Est. 2018" caption at top center
- Corner L-bracket registration marks appear
- "Relish · International Veg Cuisine" label at bottom

**Transition S1 → S2 — Blur crossfade (1.25s)**
- Scene 1 blurs to 22px + scales to 1.04 + fades out
- Scene 2 starts blurred, then sharpens in

**Scene 2 — The Plate (1.54–2.95s)**
- Warm ember gradient background (`#1C0A02` → `#B07030`)
- Plate SVG springs up from scale 0.28 with `elastic.out(1, 0.65)`
- Sauce stroke path draws from left to right (stroke-dashoffset animation)
- Protein stack slides down from above
- Herb garnish pops in with `back.out(3)` overshoot
- Micro greens appear
- 6 sauce dots scatter (gold + maroon)
- Steam wisps fade in above plate
- Caption strip slides up from bottom

**Transition S2 → S3 — Focus pull (2.95s)**
- Scene 2 blurs to 18px + fades out
- Scene 3 fades in

**Scene 3 — RELISH Reveal + Ingredients (3.08–7.5s)**
- Dark velvet background (`#0B0305`)
- Gold underlight bloom pulses up from below (large blurred radial gradient)
- Top gold hairline rule draws from left to right
- RELISH letters tumble in one by one (3D rotateX + translateY + opacity, stagger 0.09s)
- Gold underline draws below RELISH
- "INTERNATIONAL VEG CUISINE" subtitle fades in
- Flanking ✦ ornaments appear
- Bottom gold rule draws in
- Then at t=4.35s: **8 ingredient silhouettes float upward**
  - Star anise, red chili, oil bottle, bay leaf, garlic clove, cardamom pod, cinnamon stick, peppercorn trio
  - Each at opacity 0.18–0.22 (very subtle — atmospheric, not distracting)
  - Each drifts upward + sideways + rotates for 2.7–3.4 seconds
  - All fade out at t=6.80s
- Fade-to-dark overlay covers screen from t=6.90s
- Loop restarts at t=7.50s

### The loop mechanism

```js
var tl = gsap.timeline({
  paused: true,
  onComplete: function() { tl.restart(); }
});

// EVERY element gets a tl.set() reset at t=0
// This is mandatory — without it, tweens accumulate wrong state on restart
tl.set('#s3-l0', { opacity: 0, rotateX: -52, y: 18 }, 0);
// ... (all other resets)

// All animations are tl.to() or tl.from() after t=0
// ...

window.__timelines['relish-hero'] = tl;

// Auto-play when loaded standalone (iframe without HyperFrames player):
if (typeof window.__hyperframes === 'undefined') {
  tl.play();
}
```

### The 8 ingredient SVGs

All inline SVG elements positioned in the lower 60% of the 812px frame (y > 500px):

| ID | Element | Start position | Drift |
|----|---------|---------------|-------|
| `#ing-anise` | Star anise (4 petals + center) | left:42, top:680 | y:-130, x:+18, rot:48° |
| `#ing-chili` | Red chili pepper | left:284, top:710 | y:-160, x:-24, rot:-22° |
| `#ing-bottle` | Olive oil bottle | left:318, top:560 | y:-180, x:-12, rot:8° |
| `#ing-bay` | Bay leaf | left:22, top:520 | y:-140, x:+30, rot:35° |
| `#ing-garlic` | Garlic clove | left:196, top:740 | y:-170, x:-14, rot:-18° |
| `#ing-cardamom` | Cardamom pod | left:78, top:760 | y:-200, x:+16, rot:60° |
| `#ing-cinnamon` | Cinnamon stick | left:248, top:650 | y:-155, x:-8, rot:-35° |
| `#ing-pepper` | Peppercorn trio | left:138, top:700 | y:-150, x:+10, rot:12° |

### Debugging the composition

Open browser DevTools on localhost:5173, then in Console:
```js
// Access the iframe's timeline directly
const iframe = document.querySelector('iframe[title="Relish hero animation"]');
const tl = iframe.contentWindow.__timelines['relish-hero'];

tl.time()           // current playhead position (seconds)
tl.paused()         // is it paused?
tl.seek(5.2)        // jump to t=5.2s (ingredients visible)
tl.seek(3.4)        // jump to t=3.4s (RELISH letters appearing)
tl.play()           // resume
tl.restart()        // restart loop

// Check ingredient state
iframe.contentWindow.getComputedStyle(
  iframe.contentWindow.document.getElementById('ing-anise')
).opacity
```

---

## 7. The Landing Page (LandingCover)

`src/screens/LandingCover.tsx` — the Classic variant.

### Layout structure

```
<div>  (relative, flex-col, min-h-dvh, background: #0B0305)
  │
  ├── <iframe> position:absolute inset:0 z-index:0
  │     hero-reel.html fills the full viewport as a live background
  │
  ├── <div> top gold accent bar  z-index:20  (3px gradient line)
  │
  ├── <div> dark gradient vignette  z-index:10  (height: 64%, bottom-anchored)
  │     transparent at top → near-opaque black at bottom
  │     creates readable backdrop for the React content below
  │
  ├── <div class="flex-1">  minHeight: 36vh
  │     spacer — keeps the composition area visible (top 36% of screen)
  │
  ├── <div> interactive overlay  z-index:20
  │     ├── tagline (italic Cormorant Garamond)
  │     ├── trust badges (100% Veg, Jain Options, Fresh Daily)
  │     ├── PrimaryBtn — "Open Menu" (maroon gradient + shimmer)
  │     ├── GoldBtn    — "Recommend Something" (gold border + rotating star)
  │     └── GhostBtn   — "Call Waiter" (cream semi-transparent)
  │
  ├── <div> bottom gold accent bar  z-index:30
  │
  └── 4× corner SVG ornaments  z-index:22  (gold L-brackets)
```

### Media priority

```ts
const HERO_HTML_SRC = '/assets/hero-reel.html'  // ← ACTIVE
const HERO_VIDEO_SRC = ''     // set to '/assets/hero-reel.mp4' when Kling AI is ready
const HERO_POSTER_SRC = ''    // set to '/assets/hero-poster.jpg' for video poster frame

// Rendering logic:
HERO_VIDEO_SRC  → <video autoPlay muted loop playsInline>
HERO_HTML_SRC   → <iframe>                        ← current state
neither         → CSS atmospheric gradient fallback
```

### The three buttons

**PrimaryBtn (Open Menu)**
- Maroon gradient background
- CSS `shine-sweep` keyframe: shimmer highlight sweeps across every 3.4s
- Framer Motion: spring entrance from `x: -56`
- Tap: scale 0.93 + ripple burst expansion

**GoldBtn (Recommend Something)**
- Gold border + semi-transparent gold fill
- CSS `gold-pulse` keyframe: outward box-shadow pulse every 3s
- Framer Motion: spring entrance from `x: +56`
- Rotating ✦ star icon (6s full rotation, infinite)

**GhostBtn (Call Waiter)**
- Fully transparent background
- Cream text `rgba(255,248,234,0.52)` — readable on dark background
- CSS `ghost-breathe` keyframe: subtle border glow
- Framer Motion: spring entrance from `y: +32`

> ⚠️ **Color note:** GhostBtn was originally dark text (`rgba(42,30,30,0.6)`) — designed for
> the light paper background. When we switched to full-screen dark composition, it became
> invisible. Now uses cream text. If you ever switch back to a light background, change it back.

---

## 8. All 4 Landing Variants

Switchable via the pill buttons in the top-right corner (only visible on the cover screen).

| Key | Component | Description |
|-----|-----------|-------------|
| `classic` | `LandingCover.tsx` | Dark cinematic — HyperFrames composition full-screen bg |
| `gastronomique` | `LandingGastronomique.tsx` | Art Deco / French bistro — paper bg, ornate SVG rules, gold filigree |
| `editorial` | `LandingEditorial.tsx` | Magazine / high contrast — bold type, minimal layout |
| `botanica` | `LandingBotanica.tsx` | Botanical — olive tones, leaf illustrations, organic feel |

Only `classic` has the composition background. The other three use the paper `--paper: #FFF8EA`
background with their own visual languages.

All four share the same `Props` interface:
```ts
interface Props {
  onOpenMenu: () => void
  onRecommend: () => void
  onWaiter: () => void
}
```

---

## 9. Menu Screens

### MenuBooklet (`src/screens/MenuBooklet.tsx`)

The main menu shell. Contains:
- `TopBar` — Relish logo (left) + active category name (center) + waiter bell (right)
- `CategoryNav` — horizontally scrollable category pills with animated active indicator
- `CategoryPage` component rendered for the active category
- `BottomNav` — sticky bottom with three tappable zones

### CategoryPage (`src/screens/CategoryPage.tsx`)

- Maroon serif category title + italic editorial description
- Featured image placeholder (cream stripe box)
- Category-specific ambient animation component (BubblesAnim, SteamAnim, etc.)
- Item list with Framer Motion stagger fade-in (100ms per item)
- "Ask AI for a recommendation" mini-CTA at bottom of list

### RecommendationFlow (`src/screens/RecommendationFlow.tsx`)

3 sequential question steps. Each question animates in after the previous answer is given:
1. **Mood** — 8 chips (Adventurous, Comforting, Light, Indulgent, Healthy, Romantic, Quick, Sharing)
2. **Party size** — 5 chips (Just Me, For Two, Small Group, Large Table, Family)
3. **Budget** — 3 chips (Light, Moderate, Feast)

`useRecommendation` hook scores every item against the answers — additive point system, pure
client-side, no API. Returns top 3 ranked recommendation paths. Highest scorer gets gold border.

### ItemDetail (`src/screens/ItemDetail.tsx`)

Bottom sheet. Framer Motion `y: "100%" → 0` spring transition.
- `drag="y"` with `dragConstraints` — drag down to dismiss
- Image placeholder (scales 1→1.05 on open)
- Customization options, pairings, "Add to Order" CTA

### AddToOrder (`src/screens/AddToOrder.tsx`)

- Dish card "lifts" (y: -20)
- Order slip slides up from bottom
- Item "lands" on slip with spring bounce
- Green SVG checkmark scales in
- CTAs: "Show to Waiter" / "Continue Browsing"

### WaiterPanel (`src/screens/WaiterPanel.tsx`)

- Bell SVG rings (rotate ±3°) on open
- Gold radial SVG ripple expands outward
- 5 quick-tap option chips: "Need the bill", "More water", "Extra napkins", etc.
- Confirmation state: "Request sent ✓" with fade-in check

### OrderPanel (`src/screens/OrderPanel.tsx`)

- Full cart view with items, quantities, customizations
- Running total
- "Show to Waiter" CTA

---

## 10. Data Layer

### Menu structure (`src/data/menu.ts`)

```ts
interface MenuItem {
  id: string
  name: string
  price: number          // in rupees (e.g. 280)
  description: string
  isJain: boolean        // strictly Jain (no onion/garlic)
  canBeJain: boolean     // can be made Jain on request
  tags: string[]         // e.g. ['Spicy', 'Chef Special', 'Bestseller']
  pairings: string[]     // item IDs that pair well (shown in ItemDetail)
  customizations: string[] // options e.g. ['Extra cheese', 'Less spicy']
}

interface MenuCategory {
  id: string
  name: string
  description: string
  items: MenuItem[]
}
```

### 5 categories

| Category | Item count | Notable items |
|----------|-----------|---------------|
| Beverages | 8 | Fresh Lime Soda, Masala Chai, Cold Coffee, Mango Lassi, Watermelon Cooler |
| Soups | 6 | Tomato Basil, Sweet Corn, Hot & Sour, Minestrone, Broccoli Cheddar |
| Quick Bites | 7 | Veg Platter, Loaded Nachos, Spring Rolls, Garlic Bread, Bruschetta |
| Italian Fiesta | 8 | Pasta Arrabbiata, Margherita, Pesto Pasta, Lasagna, Focaccia |
| Desserts | 7 | Tiramisu, Gulab Jamun, Choco Lava, Kulfi Trio, Cheesecake |

### Recommendation scoring (`src/hooks/useRecommendation.ts`)

Pure client-side. No AI API call — the word "AI" in the UI refers to the scoring algorithm,
not an external LLM. Scoring is additive points:
- Mood answer → boosts certain tags (e.g. "Comforting" boosts Soups + Desserts)
- Party size → boosts sharing platters for large groups
- Budget → filters by price range

Returns array of `{ items: MenuItem[], score: number, path: string }` sorted by score descending.

---

## 11. Animation System

### Framer Motion variants (`src/animations/variants.ts`)

```ts
fadeIn       { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
fadeUp       { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }
stagger      { visible: { transition: { staggerChildren: 0.1 } } }
slideLeft    { hidden: { x: '100%' }, visible: { x: 0 } }
slideRight   { hidden: { x: '-100%' }, visible: { x: 0 } }
bottomSheet  { hidden: { y: '100%' }, visible: { y: 0 } }  // spring damping 20
scaleIn      { hidden: { scale: 0.8, opacity: 0 }, visible: { scale: 1, opacity: 1 } }
chipTap      { whileTap: { scale: 0.95 } }
```

### Category ambient animations

Each category page renders its matching animation component behind the item list:

| Category | Component | Technique |
|----------|-----------|-----------|
| Beverages | `BubblesAnim` | 5 circles, CSS `@keyframes` float upward + fade |
| Soups | `SteamAnim` | Wavy SVG path animated upward |
| Quick Bites | `PlateAnim` | Border reveal + scale on viewport enter |
| Italian | `SwirlAnim` | SVG spiral stroke-dashoffset draw-in |
| Desserts | `DrizzleAnim` | SVG drizzle path draws downward |
| Waiter | `BellRipple` | Bell rotates ±3° + SVG ripple circle expands |

### HyperFrames / GSAP in hero-reel.html

See Section 6 above. Key GSAP patterns used:
- `tl.from()` — entrance animations (element enters FROM the given state)
- `tl.to()` — exit animations and ingredient drifts
- `tl.set()` — instant-set at t=0 for loop resets (critical)
- `attr: {}` tween wrapper for SVG attributes (stroke-dashoffset, opacity)
- `elastic.out(1, 0.65)` for plate spring
- `back.out(3)` for herb garnish overshoot
- `expo.out` for rule lines
- `power3.out` for letter entrances

---

## 12. What We Tried That Failed

These are documented so you don't repeat them.

### ❌ `repeat: -1` for looping ingredient animations

GSAP `repeat: -1` makes a tween loop infinitely. HyperFrames explicitly bans this — it breaks
the video capture engine. We tried it, confirmed it breaks the loop, and replaced with
`repeat: 0` (single motion) timed to end before the fade-out at t=6.80s.

### ❌ `tl.from()` for letters in a looping timeline

`tl.from('#s3-l0', { opacity: 0, rotateX: -52 })` works on the first play. On loop restart,
GSAP has already "consumed" the from state — the letter's current state becomes the new
from-baseline. Result: on the second loop, the letter jumps to full opacity immediately.

**Fix:** Use `tl.set()` at t=0 to force the initial state, then `tl.to()` to animate to the
final state. This is loop-safe because `set()` at t=0 always runs before any other tweens.

```js
// WRONG:
tl.from('#s3-l0', { opacity: 0, rotateX: -52, y: 18 }, 3.4);

// CORRECT:
tl.set('#s3-l0', { opacity: 0, rotateX: -52, y: 18 }, 0);   // reset at loop start
tl.to( '#s3-l0', { opacity: 1, rotateX:  0,  y:  0 }, 3.4); // animate on cue
```

### ❌ stroke-dashoffset not resetting on loop

The SVG sauce path and gold hairline rules use stroke-dashoffset animation to "draw" lines.
On second loop, the dashoffset stayed at 0 (fully drawn) instead of resetting to the initial
value, so the draw animation never played again.

**Fix:** Explicit `tl.set(..., { attr: { 'stroke-dashoffset': 335 } }, 0)` at t=0 for every
animated path. You must use the `attr: {}` wrapper — not bare `stroke-dashoffset`.

### ❌ Three.js canvas as landing background

The original plan used `CoverBackground.tsx` (Three.js WebGL canvas) — 30 floating gold/maroon
particles as the landing page background. We built it, it worked, but:
- Visual quality was modest (floating dots, not cinematic)
- Competed with the plate/menu content rather than complementing it
- Added a full WebGL context just for background ambience

**Replaced by:** The HyperFrames composition, which gives three full cinematic scenes and also
serves as the future slot for the Kling AI video. `CoverBackground.tsx` still exists in
`src/three/` but is no longer imported anywhere — kept for reference.

### ❌ Constrained 210px hero box

Early version had the composition inside:
```tsx
<motion.div className="..." style={{ height: 210 }}>
  <iframe ... />
</motion.div>
```
User feedback: "I want it to be on the whole page." The 210px box was removed entirely.
The iframe now fills `position: absolute; inset: 0` — the full viewport.

### ❌ `min-h-dvh` on html/body inside the iframe

When the composition's `html, body` had `min-h-dvh` or percentage heights relative to the
viewport, the iframe document could be taller than its container, causing scrollbars.

**Fix:** `html, body { width: 100%; height: 100%; overflow: hidden; }` inside hero-reel.html.
The iframe container clips it. Never use viewport-relative units inside an iframe.

### ❌ Plate centering using CSS `transform: translate(-50%, -50%)`

When we tried to center the plate SVG with CSS transform and then also animate it with GSAP
`scale`, the two transforms conflicted. GSAP would overwrite the centering transform.

**Fix:** Calculate the pixel offset manually and use absolute pixel coordinates:
```
left = (375 - 180) / 2 = 97.5px → left: 97px
top = 28% × 812 = 227px → top: 204px (adjusted for visual centering)
```
This lets GSAP animate `scale` freely without any transform conflict.

---

## 13. Known Issues & Rough Edges

### Visual

1. **Ingredient visibility through gradient** — The dark gradient overlay (z-10, height 64%)
   covers the area where most ingredients drift. Only the oil bottle and bay leaf reach a
   semi-transparent zone (~47% from top). Other ingredients are mostly hidden behind the
   gradient. This is partly intentional (ghostly atmospheric quality) but if you want more
   visible spices, either increase drift distance or reduce gradient height to ~55%.

2. **Duplicate corner marks** — Both the React `LandingCover` and the HyperFrames composition
   render corner L-bracket ornaments. In the upper corners, two sets of marks overlap slightly.
   Remove either the React ones (at bottom of `LandingCover.tsx`) or adjust the composition's
   corner marks to a different position.

3. **First loop font flash** — Playfair Display loads async. On very first page load, the
   Scene 3 RELISH letters may briefly render in the system serif font before Playfair loads.
   Fix: wrap `tl.play()` in `document.fonts.ready.then(() => tl.play())` in hero-reel.html.

4. **Steam wisps don't animate** — The steam SVG paths in Scene 2 fade in but don't move
   upward. They're static opacity reveals. Should have a continuous upward drift.

### Functional

5. **OrderPanel "Send Order" state** — The order cart is built but there's no confirmation
   state after "Show to Waiter". It just closes. A "Order submitted ✓" confirmation screen
   or animation is missing.

6. **ItemDetail drag sensitivity** — On some devices, the `dragConstraints` threshold for
   dismissing the bottom sheet is slightly too sensitive. Accidental dismissals happen when
   scrolling within the sheet. May need `dragElastic` tuning.

7. **CategoryNav active pill on initial load** — The animated underline indicator starts at
   the first pill position but there's a brief flash before the layout animation settles.
   Minor visual glitch, not a bug.

---

## 14. Roadmap — What's Left to Build

### Priority 1 — Polish existing screens

- [ ] Fix font flash on first load (wrap `tl.play()` in `document.fonts.ready`)
- [ ] Add steam wisp upward animation in Scene 2
- [ ] Remove duplicate corner ornaments
- [ ] Tune ingredient drift distances for better visibility through gradient
- [ ] OrderPanel "send order" confirmation state
- [ ] ItemDetail scroll-within-sheet without accidental dismiss

### Priority 2 — Kling AI video integration

When Kling AI video is ready, see Section 15 for full workflow. The code change is:
```ts
// In src/screens/LandingCover.tsx:
const HERO_VIDEO_SRC = '/assets/hero-reel.mp4'
const HERO_POSTER_SRC = '/assets/hero-poster.jpg'
```
No other changes needed — the priority logic already handles it.

### Priority 3 — Apply composition to other variants

Currently only Classic has the cinematic background. If we want Deco/Editorial/Botanica to
also have it, add the iframe to those screens (with potentially different compositions or
the same one).

### Priority 4 — Real menu data + food photography

- Replace `src/data/menu.ts` mock data with real menu items from the restaurant
- Add real food photography (replace `ImagePlaceholder` components)
- Photography format: 800×600px WebP, shot at 20–30° angle, warm lighting

### Priority 5 — QR code + deployment

- Generate QR code pointing to production URL
- Deploy to Vercel (zero config with `vercel.json`): `vercel deploy`
- Or Netlify: drag the `dist/` folder into Netlify dashboard
- Or GitHub Pages: add a workflow file

### Priority 6 — Missing screens from original spec

- **Language selector** — multi-language support (English/Gujarati/Hindi)
- **Table number input** — for order submission context
- **Real order submission** — POST to a backend / WhatsApp link / email

---

## 15. Media Production (Nano Banana + Kling AI)

The HyperFrames composition is the current background. The plan was always to eventually
replace it with a real cinematic video generated by AI tools.

### Workflow

```
Nano Banana generates:   start frame image  +  end frame image
        ↓
Kling AI takes both images and generates a 4-second video between them
        ↓
Export as hero-reel.mp4 (H.264, 375×812, 4s, loopable)
        ↓
Drop in public/assets/ → set HERO_VIDEO_SRC in LandingCover.tsx
```

### Nano Banana — Start Frame Prompt (candlelight scene)

> "A single elegant white ceramic plate on a dark restaurant table, shot from slightly above
> at 20°, surrounded by scattered spices — star anise, cardamom, a cinnamon stick — on a
> surface of deep maroon and black. The plate is empty with a faint gold rim. Warm candlelight
> from the left casts a soft amber glow. Photorealistic, editorial food photography, shallow
> depth of field, dark background."

### Nano Banana — End Frame Prompt (RELISH reveal)

> "Dark velvet black background. The word RELISH in large cream-gold Playfair Display serif
> font, centered, with a thin gold underline beneath it. Below the text: 'INTERNATIONAL VEG
> CUISINE' in small gold caps, with a small ✦ ornament on each side. Scattered spice
> silhouettes — star anise, chili, bay leaf — floating upward around the word. Cinematic,
> luxury restaurant branding aesthetic."

### Kling AI — Video Prompt

> "Slow cinematic push into the plate from above. The candlelight flickers gently. Aromatic
> spices drift upward — star anise, cardamom, chili. A sauce stroke appears on the plate.
> Then the spices dissolve into the word RELISH glowing in cream gold, letter by letter, as
> the camera pulls back to reveal the full scene. Duration 4 seconds, 24fps, film grain,
> luxury restaurant aesthetic."

---

## 16. Key Technical Gotchas

```
┌─────────────────────────────────────────────────────────────────────┐
│ HyperFrames Rules (violations cause broken compositions)            │
├─────────────────────────────────────────────────────────────────────┤
│ ✗ NEVER use repeat: -1  (breaks capture engine)                    │
│ ✗ NEVER use tl.from() on elements that loop (use set+to instead)   │
│ ✓ ALWAYS register:  window.__timelines['comp-id'] = tl             │
│ ✓ ALWAYS reset all elements with tl.set(..., 0) at the start       │
│ ✓ ALWAYS use attr:{} wrapper for SVG attribute tweens              │
│ ✓ ALWAYS start paused: true  (player controls playback)            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ SVG attribute animation                                             │
├─────────────────────────────────────────────────────────────────────┤
│ tl.to('#path', { attr: { 'stroke-dashoffset': 0 } })   ← CORRECT  │
│ tl.to('#path', { 'stroke-dashoffset': 0 })              ← WRONG    │
│ tl.to('#el',   { attr: { opacity: 1 } })               ← CORRECT  │
│   (for SVG elements — HTML elements use bare opacity: 1)           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ iframe same-origin debugging                                        │
├─────────────────────────────────────────────────────────────────────┤
│ const iframe = document.querySelector('iframe[title="..."]')       │
│ const tl = iframe.contentWindow.__timelines['relish-hero']         │
│ tl.seek(5.2)   // jump to ingredients scene                        │
│ tl.time()      // check current position                           │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ GhostBtn color depends on background                               │
├─────────────────────────────────────────────────────────────────────┤
│ Dark bg (Classic):  color: rgba(255,248,234,0.52)  ← current       │
│ Light bg (others):  color: rgba(42,30,30,0.6)                      │
│ If you change the bg, change the button color too                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 17. Contributing

### Branching convention
```
main            — stable, always deployable
feature/xxx     — new features
fix/xxx         — bug fixes
design/xxx      — visual changes to existing screens
```

### Before pushing
- `npm run build` must pass with zero errors
- Test on a 375px mobile viewport in Chrome DevTools
- Check all 4 landing variants still render
- Tap through: cover → menu → category → item detail → add to order → waiter panel

### Adding a menu item

Edit `src/data/menu.ts`. Add to the appropriate category's `items` array:
```ts
{
  id: 'bev-009',
  name: 'Rose Sharbat',
  price: 160,
  description: 'Chilled rose syrup with basil seeds and a hint of cardamom',
  isJain: true,
  canBeJain: true,
  tags: ['New', 'Refreshing'],
  pairings: ['bev-001', 'des-003'],
  customizations: ['Less sweet', 'No basil seeds'],
},
```

### Adding a new category

1. Add to `MenuCategory[]` in `menu.ts`
2. Create a new ambient animation component in `src/components/animations/`
3. Add the mapping in `CategoryPage.tsx` (category ID → animation component)
4. Add a pill to `CategoryNav.tsx`

---

_This guide was written at the end of the initial build session (2026-05-20)._
_The project is actively in development. When in doubt, read the source — it's well-commented._
