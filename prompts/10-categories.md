# Relish — Category Images (5 transparent cut-outs)

> These 5 images replace the last hand-drawn SVG in the app (the `CategoryIllustration`
> fallback). They render centred on a themed gradient when a category banner is shown,
> and as the graceful fallback if a banner photo ever fails to load.
> Same chroma-key → transparent-PNG workflow as the ingredients (`09-ingredients.md`).

---

## What you're making

5 hero "category" food cut-outs — one signature dish per category — on a **flat chroma-green
screen**, which we then key out to transparent PNG with the existing script.

| Category | File | Subject (signature dish) |
|---|---|---|
| Beverages | `beverages.png` | tall frosted glass of fresh lime-mint cooler |
| Soups | `soups.png` | white bowl of golden creamy soup |
| Quick Bites | `quickbites.png` | plate of golden paneer tikka skewers |
| Italian | `italian.png` | personal wood-fired margherita pizza |
| Desserts | `desserts.png` | single slice of tiramisu |

---

## Output spec (every image)

| Property | Value |
|---|---|
| Generate at | **1024 × 1024 px** on flat chroma green (bigger = cleaner key) |
| Final export | **512 × 512 px**, **PNG with alpha** (after keying), subject centred |
| Background (gen) | flat solid **chroma green `#00FF00`**, edge-to-edge, NO gradient/shadow/texture |
| Subject | single dish, centred, fills ~80% of frame |
| Folder (final) | **`public/assets/categories/`** |
| Filename | exactly as the table above (lowercase) |

---

## CHROMA CUT-OUT BASE BLOCK
*Paste this verbatim, then append the per-category subject line + the Negative block.*

```
[CHROMA CUT-OUT]
Subject: a single [DISH], plated as described, floating, no surface beneath it
BACKGROUND: Solid, flat, uniform chromakey green colour, EXACTLY hex #00FF00 (RGB 0,255,0),
       filling the entire frame with NO variation, NO gradient, NO shadow on the background,
       NO lighting falloff, NO texture — one pure flat green edge-to-edge
Subject lighting: soft warm window light from upper-left, ~3200 K, gold-amber key, soft wrap,
       a faint self-shadow on the dish's own underside only (never cast on the background)
Plate grammar: matte white ceramic with a fine double rim — outer ring #8B1024 (deep red),
       inner ring #D9A03A (gold); beverages use clear glassware instead of a plate
Edge: crisp clean silhouette with a thin 2–3 px clean light separation rim, fully in focus
NO COLOUR SPILL: absolutely no green tint, fringe, or reflection on the food — edges and wet
       highlights stay their natural colour
Finish: photorealistic, Michelin-guide quality, appetising, fresh, fine real texture,
       warm Relish palette (reds #8B1024/#A52030, golds #D9A03A, cream #FFF8EA), no CGI sheen
```

**Negative (use for ALL 5):**
```
Negative: no second background colour, no gradient background, no shadow cast on the background,
no table, no extra props, no text, no watermark, no logo, no hands, no fingers,
no green colour spill or fringe on the food, no white/coloured halo, no blurred subject,
no blue/grey/cool tones, no CGI plastic sheen, no duplicate dish
```

---

## The 5 per-category subject lines

### 1. `beverages.png`
```
Subject: a tall frosted highball glass of fresh lime-mint cooler — pale green, fizzy, heavy
condensation on the glass, a lime wheel on the rim, fresh mint sprig, ice cubes, a paper straw,
standing on a small cream coaster (no plate). Bright, refreshing, summery.
```

### 2. `soups.png`
```
Subject: a shallow wide white ceramic bowl (red+gold double rim) of golden creamy tomato-basil
soup, a swirl of cream on top, a single basil leaf garnish, gentle steam rising. Warm, comforting.
```

### 3. `quickbites.png`
```
Subject: a white plate (red+gold double rim) with 3–4 golden grilled paneer tikka skewers,
visible char marks, red onion rings, a wedge of lime, and a small bowl of green mint chutney
to the side. Tandoor-fresh, appetising.
```

### 4. `italian.png`
```
Subject: a personal wood-fired margherita pizza on a white plate (red+gold double rim) — bubbled
charred crust, melted mozzarella, red tomato sauce, fresh basil leaves, a drizzle of golden olive
oil #D9A03A. Stone-fired, rustic, premium.
```

### 5. `desserts.png`
```
Subject: a single elegant slice of tiramisu on a white plate (red+gold double rim) — visible
sponge + cream layers, dusted with cocoa #2A1E1E, a small espresso cup just behind it.
Indulgent, refined.
```

---

## How to turn them transparent (chroma key → PNG)

1. Generate all 5 on flat green per the prompts; save as PNG/JPG.
2. Put them in a top-level **`raw-categories/`** folder (kept local, like `raw-ingredients/`).
3. Run the keyer (it already auto-detects green and outputs trimmed, centred transparent PNGs):
   ```bash
   node scripts/key-ingredients.mjs raw-categories public/assets/categories
   ```
   - Green is auto-detected from the border; output is `512²`-ready transparent PNG.
   - If any edge halo remains, the script's despill handles it; see `09-ingredients.md` § Extraction.

4. Tell me when they're in `public/assets/categories/` — I'll wire `CategoryPage` to render them
   (centred on a themed gradient) in place of the SVG `CategoryIllustration`, and delete the SVG.

---

## QA checklist
- [ ] Background was one flat pure `#00FF00`, no gradient/shadow
- [ ] Dish fills ~80% of frame, centred, warm upper-left light
- [ ] White ceramic plate shows the red `#8B1024` + gold `#D9A03A` double rim (beverages = glass)
- [ ] No green spill/fringe on the food, no text, no extra props
- [ ] Final = transparent PNG, 512×512, named exactly (`beverages.png` … `desserts.png`)
