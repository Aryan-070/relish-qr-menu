# Relish QR Menu — Session Handoff

_Last updated: 2026-05-28 · Media assets wired, ServicePanel built, video prompts finalised_

---

## Goal

Build **Relish — International Veg Cuisine** — a premium cinematic QR menu SPA.

**Milestone this session:** Wire all dish/cover/banner images into the app as WebP files with graceful fallbacks, replace WaiterPanel with the full ServicePanel tableside hub, and produce the complete set of Google Veo video prompts for the animated backgrounds.

**End-state target:**
- All 6 Veo-generated videos dropped in → app has no static fallback screens left
- ServicePanel fully QA'd across all 4 landing themes
- Build verified green, deployed to Netlify/Vercel

---

## Current State of the Code

### What is COMPLETE and working ✅

**All dish images wired (WebP)**
- `MenuCard.tsx` — thumbnail `public/assets/dishes/{id}.webp` with emoji fallback
- `ItemDetail.tsx` — hero `public/assets/dishes/{id}-hero.webp` with `CategoryIllustration` SVG fallback
- Key pattern: `key={item.id}` on `<img>` forces React remount so `onError` state resets when a new item opens

**All category banners wired (WebP)**
- `CategoryPage.tsx` — `BANNER_FILE` map resolves the `desserts` → `dessert-banner.webp` singular quirk
- `aspect-[21/9]` photo banner + `CategoryIllustration` SVG fallback on load error

**All landing cover images wired (WebP)**
- `LandingBotanica.tsx` — circular `cover-botanica-plate.webp` (178×178, border-radius 50%)
- `LandingGastronomique.tsx` — full-bleed `cover-deco-portrait.webp` inside the art-deco frame
- `LandingEditorial.tsx` — full-width `cover-editorial-spread.webp` hero strip between headline and first rule

**PNG → WebP batch conversion (done)**
- `scripts/convert-to-webp.mjs` — converted 68 files, deleted all originals
- `public/assets/covers/` — 10 WebP files; `public/assets/dishes/` — 60+ WebP files
- Every `.png` reference in source code updated to `.webp`

**TypeScript build errors fixed**
- `LandingBotanica.tsx` — removed unused `GOLD` and `CREAM` constants (TS6133)

**ServicePanel built (`src/screens/ServicePanel.tsx`)**
- Replaces `WaiterPanel.tsx` entirely
- Views: `home | waiter | water | bill | more | jain | sent`
- Home: drag handle + table tag + greeting + hero "Call our waiter" card + 3×2 action grid + live request feed
- Waiter view: animated approach silhouette, ETA countdown (42s), Hide/Cancel
- Water, Bill, More sub-sheets with option grids
- Jain sub-view carries over Q&A from old WaiterPanel
- Toast notification (2.4s auto-dismiss, AnimatePresence)
- Live feed: FeedItem state, pending→done auto-transition after 4.5s
- Theme: cream/warm (paper-bg), maroon gradient hero button, gold accents — soothing for Classic

**New animation variants (`src/animations/variants.ts`)**
- `fullPanel` — full-screen overlay fade (used by waiter view)
- `slideInRight` — spring slide for sub-sheets (water/bill/more)

**New CSS keyframes (`src/tokens.css`)**
- `pulse-glow` — soft maroon/gold shadow pulse on hero call button
- `waiterApproach` — blur rack to sharp, scale 0.4→1, with translateY
- `waiter-sway` — body oscillation ±3%
- `water-pour` — stream animation for water sub-sheet
- `feed-enter` — feed row slide-in from left

**`App.tsx` wired**
- Imports `ServicePanel` (no more `WaiterPanel`)
- Passes `onOpenMenu`, `onViewOrder`, `orderCount`, `total` props

**Image prompt library complete (`public/assets/prompts/`)**
- `00-style-guide.md` — master palette + negative prompts
- `01-covers.md` — 3 cover images
- `02-category-banners.md` — 5 banners
- `03-beverages.md` through `07-desserts.md` — 30 dishes × 2 (thumbnail + hero) = 60 prompts
- `08-video-reels.md` — 6 Veo video prompts (see below)

**Video prompt file (`public/assets/prompts/08-video-reels.md`)**
- 6 videos, correct scope (only LandingCover gets a hero video — other landings stay static)
- vid-001: Classic hero, `veo-3.1-generate-preview`, 8s, 4K, 9:16, dark cinematic
- vid-002 to vid-006: Category ambient loops, `veo-3.1-fast-generate-preview`, 6s, 4K, 9:16
- Mapping: vid-002 Beverages (BubblesAnim), vid-003 Soups (SteamAnim), vid-004 QuickBites (PlateAnim), vid-005 Italian (SwirlAnim), vid-006 Desserts (DrizzleAnim)
- Each prompt is self-contained, no reference images required
- SILENT SCENE directive + SFX line + per-category food exclusions in Negative

---

## Files Actively Edited This Session

| File | Change |
|------|--------|
| `src/screens/ServicePanel.tsx` | **NEW** — full tableside service hub replacing WaiterPanel |
| `src/App.tsx` | Import ServicePanel, add onOpenMenu/onViewOrder/orderCount/total props |
| `src/animations/variants.ts` | Added `fullPanel`, `slideInRight` variants |
| `src/tokens.css` | Added 5 `@keyframes`: pulse-glow, waiterApproach, waiter-sway, water-pour, feed-enter |
| `src/screens/LandingBotanica.tsx` | Build fix (removed unused GOLD/CREAM), wired circular cover image |
| `src/screens/LandingGastronomique.tsx` | Replaced SVG plate with deco portrait WebP |
| `src/screens/LandingEditorial.tsx` | Added editorial food spread hero strip |
| `src/screens/CategoryPage.tsx` | Wired .webp banners, updated BANNER_FILE map |
| `src/components/molecules/MenuCard.tsx` | Wired .webp dish thumbnails + emoji fallback |
| `src/screens/ItemDetail.tsx` | Wired .webp dish heroes + CategoryIllustration fallback |
| `public/assets/covers/` | 10 WebP cover + banner images (untracked → staged) |
| `public/assets/dishes/` | 60+ WebP dish thumbnails + heroes (untracked → staged) |
| `public/assets/prompts/` | 9 prompt MD files (untracked → staged) |
| `scripts/convert-to-webp.mjs` | One-time PNG→WebP batch conversion (already run) |

---

## What Was Tried and Failed

**Landscape images as first/last frame for 9:16 video**
All source dish photos are 4:3 or 21:9 landscape. An early attempt used them as Veo `first_frame_image` for 9:16 portrait video — the generated video was badly composed (black bars, wrong crop). Fixed by removing first/last frame fields entirely and using only text prompts. Prompts are now detailed enough that reference images are supplementary, not required.

**Wrong Veo model IDs (`veo-3.1-pro`, `veo-3.1-fast`)**
These are not valid API identifiers. After installing the `veo-video-generation` skill, confirmed correct IDs: `veo-3.1-generate-preview` (Pro) and `veo-3.1-fast-generate-preview` (Fast).

**Invalid 5-second duration for ambient loops**
Veo only accepts 4, 6, or 8 seconds. The first version of prompts used 5s. Fixed to 6s across all ambient loops.

**9 videos instead of 6**
Initial plan had 4 landing hero videos + 5 category ambients. Code audit showed only `LandingCover.tsx` has video infrastructure (`HERO_VIDEO_SRC`). The other 3 landing screens (Gastronomique, Editorial, Botanica) use static images and would need a full wiring pass to support video. Scope reduced to 1 hero + 5 category ambients = 6 videos total.

**QuickBites/Desserts animation labels swapped**
The first prompt draft described DrizzleAnim for QuickBites and PlateAnim for Desserts. In the code, QuickBites uses `backgroundAnimation: 'plate'` (PlateAnim → concentric circles) and Desserts uses `backgroundAnimation: 'drizzle'` (DrizzleAnim → falling gold line). Fixed in the final `08-video-reels.md`.

**Pasta in the soups ambient prompt**
An early draft of vid-003 (Soups) ended with a camera pull revealing a pasta plate. Fixed — the soups video now shows broth only, with pasta explicitly in the `Negative:` line.

---

## Next Steps

### 1. Generate videos using `08-video-reels.md`

Run each prompt through the Veo CLI:
```bash
# Hero (8s, 4K)
~/.claude/skills/veo-video-generation/generate-video.sh \
  --prompt "[vid-001 prompt text]" \
  --model veo-3.1-generate-preview \
  --duration 8 --resolution 1080p --aspect-ratio 9:16 \
  --output public/assets --filename hero-reel.mp4

# Ambient loops (6s, 4K)
~/.claude/skills/veo-video-generation/generate-video.sh \
  --prompt "[vid-002 prompt text]" \
  --model veo-3.1-fast-generate-preview \
  --duration 6 --resolution 1080p --aspect-ratio 9:16 \
  --output public/assets --filename cat-beverages.mp4
```
Requires `GEMINI_API_KEY` env var. Cost: ~$2.80/hero, ~$2.10/ambient.

### 2. Wire hero video into LandingCover.tsx

Once `public/assets/hero-reel.mp4` is ready:
```ts
// src/screens/LandingCover.tsx
const HERO_VIDEO_SRC = '/assets/hero-reel.mp4'
const HERO_POSTER_SRC = '/assets/hero-poster.jpg'
```
The existing priority logic (`HERO_VIDEO_SRC ? <video> : HERO_HTML_SRC ? <iframe> : gradient`) handles the swap automatically.

### 3. Wire category ambient videos into CategoryPage.tsx

Replace `<AnimationForCategory>` with a `<video>` tag for each category. The SVG animations stay as fallback if the video hasn't loaded yet. Suggested approach:
```tsx
// In CategoryPage.tsx hero section
<video
  key={category.id}
  src={`/assets/cat-${category.id}.mp4`}
  autoPlay muted loop playsInline
  className="absolute inset-0 w-full h-full object-cover"
  style={{ zIndex: 0, opacity: 0.6 }}
  onError={() => { /* fall through to SVG animation */ }}
/>
<AnimationForCategory type={category.backgroundAnimation} />
```

### 4. ServicePanel QA

- Open app → tap waiter button on any landing screen
- Test all 6 grid actions (Menu / AI / My Order / Water / Bill / More)
- Confirm Water sheet: pour animation + Still/Sparkling/+Ice/+Lemon cards
- Confirm Bill sheet: One bill / Split evenly / Itemise / Add gratuity
- Confirm More → Jain Info sub-view works, back button returns to More
- Confirm feed updates and pending→done auto-transition
- Test on iPhone 14 viewport (393×852) — check text doesn't overflow

### 5. Build verification
```bash
npm run build   # must have zero TypeScript errors
```

---

## Key Technical Gotchas

```
Veo valid durations: 4, 6, or 8 seconds only (not 5, not 7)
Veo 4K + duration: 1080p only works with 8s (heroes). 6s ambient loops use 720p max if 4K not supported
Veo aspect ratio flag: use --aspect-ratio 9:16 (not --aspect 9/16)
Correct model IDs: veo-3.1-generate-preview | veo-3.1-fast-generate-preview

Image fallback pattern (React):
  const [err, setErr] = useState(false)
  key={item.id}          ← forces remount on item change, resets onError state
  onError={() => setErr(true)}

Banner filename quirk:
  category.id = 'desserts' → file = 'dessert-banner.webp'  (singular, no 's')
  All others: '{id}-banner.webp'

Category animation → video mapping:
  beverages  → BubblesAnim  (bubbles)
  soups      → SteamAnim    (steam)
  quickbites → PlateAnim    (plate / concentric circles)
  italian    → SwirlAnim    (swirl)
  desserts   → DrizzleAnim  (drizzle)
```

---

## Dev Commands

```bash
cd /Users/aryanshah/Downloads/softwares/Python_Django/Automations/claude_menu
npm run dev        # localhost:5173 — iPhone 14 Pro (393×852) in DevTools
npm run build      # dist/ — verify zero TS errors
npm run preview    # serve dist/ locally
```
