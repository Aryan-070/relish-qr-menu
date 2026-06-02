# Relish — Ingredient Cut-Out Images (Chromakey → Transparent PNG)

> Powers the floating ambient bubbles on the **Signature** landing screen.
> These are the ONLY assets that break the plate/surface rules — see [`00-style-guide.md`](./00-style-guide.md).

---

## ⚠️ Why we DON'T ask for "transparent background"

Nano-banana / Gemini does **not** reliably output a true alpha channel — asking for "transparent
background" produces inconsistent, busy, or semi-opaque backdrops that are hard to extract.
The reliable pro workflow is **chromakey**: generate on a **flat solid key colour**, then remove
that colour with an HSV key / background cleaner. This gives clean, sharp edges every time.

**The catch:** a single key colour can't work for every ingredient — a green screen would also
delete green mint/basil. So we use **two key colours**, picked so the key never matches the subject:

| Key colour | Hex | Used for |
|---|---|---|
| **Chroma GREEN** | `#00FF00` | all NON-green foods (reds, browns, creams, yellow, ice-on-magenta excepted) |
| **Chroma MAGENTA** | `#FF00FF` | GREEN foods (`mint`, `basil`) + translucent `ice-cube` (no food is magenta) |

---

## Output Spec (every ingredient)

| Property | Value |
|---|---|
| Generate at | **1024 × 1024 px** on a flat chroma background (bigger = cleaner key, then downscale) |
| Final export | **256 × 256 px**, **PNG with alpha**, subject trimmed + centred |
| Background (gen) | flat solid `#00FF00` **or** `#FF00FF` per the table below — keyed out afterwards |
| Subject | single ingredient, centred, fills ~78% of frame |
| Folder | `public/assets/ingredients/` |
| Filename | exact lowercase kebab names below (e.g. `coffee-bean.png`) |

---

## CHROMA CUT-OUT BASE BLOCK
*Copy-paste verbatim, replace `{{KEY}}` with the ingredient's key colour from the table, then add the item specifics.*

```
[CHROMA CUT-OUT]
Subject: a single [INGREDIENT], product-shot, floating, no surface beneath it
BACKGROUND: Solid, flat, uniform chromakey {{KEY}} colour, EXACTLY this hex, filling the entire
       frame with NO variation, NO gradient, NO shadow on the background, NO lighting falloff,
       NO texture — one pure flat colour edge-to-edge
Subject lighting: soft warm studio light from upper-left, ~3200 K, gentle gold-amber key,
       soft wrap, a faint self-shadow on the ingredient's OWN underside only (never cast on the bg)
Edge: crisp clean silhouette with a thin 2–3 px clean light separation rim around the subject,
       fully in focus, anti-aliased
NO COLOUR SPILL: absolutely no {{KEY}} tint, fringe, glow, or reflection on the ingredient —
       its edges, wet highlights and shiny surfaces must stay their natural colour
Finish: photorealistic, fresh, appetising, fine real texture (pores, sheen, crumb, condensation
       as appropriate), warm palette (reds #8B1024/#A52030, golds #D9A03A, ivory #FFF8EA),
       no plastic CGI sheen
```

**Negative (use for ALL chroma cut-outs):**
```
Negative: no second background colour, no gradient background, no shadow cast on the background,
no surface, no plate, no table, no text, no watermark, no logo, no hands, no extra objects,
no {{KEY}} colour spill or fringe on the subject, no white/coloured halo, no blurred subject,
no CGI plastic sheen, no duplicate ingredient
```

---

## Per-Ingredient Background Key + Prompt

| File | Key colour | One-line subject |
|---|---|---|
| `lemon.png` | GREEN `#00FF00` | bright **yellow** lemon half-slice (not lime), juicy translucent segments, warm highlight |
| `mint.png` | **MAGENTA** `#FF00FF` | fresh mint sprig, 3–4 vivid green leaves, vein texture, one dew drop |
| `ice-cube.png` | **MAGENTA** `#FF00FF` | **frosted/cloudy** ice cube (mostly opaque, NOT clear glass), warm amber edge, condensation |
| `sugar.png` | GREEN `#00FF00` | raw cane-sugar cube, golden-amber `#D9A03A`, coarse crystals, a few loose grains |
| `basil.png` | **MAGENTA** `#FF00FF` | single glossy basil leaf, deep warm green, central vein, curled edge |
| `tomato.png` | GREEN `#00FF00` | ripe cherry tomato, `#A52030` red, glossy, green calyx star, tiny droplet |
| `mozzarella.png` | GREEN `#00FF00` | fresh bocconcini ball, ivory `#FFF8EA`, torn milky edge, thread of `#D9A03A` oil |
| `olive.png` | GREEN `#00FF00` | single glossy black-purple olive, warm sheen, bead of golden oil |
| `coffee-bean.png` | GREEN `#00FF00` | 2–3 roasted beans, `#2A1E1E` brown, centre crease, oily warm sheen |
| `cocoa.png` | GREEN `#00FF00` | small mound of cocoa powder, warm brown, dusty clumps, light scatter |
| `cream.png` | GREEN `#00FF00` | elegant whipped-cream swirl, ivory `#FFF8EA`, glossy peaks, soft fold shadows |
| `chocolate.png` | GREEN `#00FF00` | dark chocolate chunk, glossy `#2A1E1E`, warm amber edge, sharp facets |
| `strawberry.png` | GREEN `#00FF00` | ripe strawberry, `#A52030` red, seeded gloss, green calyx, droplet |
| `cherry.png` | GREEN `#00FF00` | glossy dark-red cherry `#8B1024`, thin stem, bright specular highlight |
| `chilli.png` | GREEN `#00FF00` | fresh red chilli, `#8B1024`–`#A52030` gloss, curved tip, green stem |
| `onion.png` | GREEN `#00FF00` | few red-onion rings, warm magenta-red layers, translucent edges |
| `paneer.png` | GREEN `#00FF00` | grilled paneer cube, ivory with golden-amber `#D9A03A` tandoor char marks, smoky highlight |

> For each prompt: paste the **CHROMA CUT-OUT** base with `{{KEY}}` set to that row's colour,
> append the one-line subject, then the matching **Negative** block.

**Example — `mint.png` (full prompt):**
```
[CHROMA CUT-OUT]
Subject: a single fresh mint sprig with 3–4 vivid green leaves, clear vein texture, one tiny dew drop, floating, no surface beneath it
BACKGROUND: Solid, flat, uniform chromakey magenta #FF00FF colour, EXACTLY this hex, filling the entire frame with NO variation, NO gradient, NO shadow on the background, NO lighting falloff, NO texture — one pure flat colour edge-to-edge
Subject lighting: soft warm studio light from upper-left, ~3200 K, gentle gold-amber key, soft wrap, a faint self-shadow on the leaves' own underside only (never cast on the bg)
Edge: crisp clean silhouette with a thin 2–3 px clean light separation rim, fully in focus, anti-aliased
NO COLOUR SPILL: absolutely no magenta tint, fringe, glow, or reflection on the mint — its edges and highlights stay natural warm green
Finish: photorealistic, fresh, appetising, fine leaf texture, warm palette, no plastic CGI sheen
Negative: no second background colour, no gradient background, no shadow cast on the background, no surface, no plate, no table, no text, no watermark, no logo, no hands, no extra objects, no magenta colour spill or fringe on the subject, no white/coloured halo, no blurred subject, no CGI plastic sheen, no duplicate ingredient
```

---

## Extraction Workflow (chroma → alpha PNG)

Pick whichever matches your tooling:

**A. Simple background cleaner / "magic wand"** (what you're using)
1. Open the generated image; the bg is one flat green or magenta.
2. Key/select that colour with a moderate tolerance (~25–35), enable anti-alias + 1–2 px feather.
3. Delete → export PNG with transparency. **Defringe / "remove colour matting"** by the key colour to kill the edge halo.

**B. HSV chroma key (best edges — scriptable, remove.bg-quality for free)**
- Convert to HSV, key the background hue:
  - **Green:** hue centre **120°**, range **±25°**, min saturation **75%**, min value **70%**
  - **Magenta:** hue centre **300°**, range **±25°**, min saturation **75%**, min value **70%**
- Dilate the mask **2 px** to catch anti-aliased edges, then **decontaminate edges** (despill).
- `rembg` also works: `rembg i in.png out.png` (AI saliency — ignores the key colour entirely, good fallback).

**C. Dual white/black (most robust — use for translucent `ice-cube` and wispy `cream`)**
1. Generate the SAME ingredient twice, identical composition: once on pure white `#FFFFFF`, once on pure black `#000000`.
2. Alpha `α = 1 − (white_px − black_px)`; true colour `= black_px / α` (classic two-pass matte). Handles
   semi-transparency (ice, cream wisps) that flat chroma can't.

**After extraction (all paths):** trim transparent margins, centre the subject in a square, export
**256 × 256 PNG**, and check there is **no coloured fringe** at 100% against a dark zoom.

---

## After Generating

1. Save each as a **transparent PNG**, 256×256, named exactly as the table.
2. Drop all into `public/assets/ingredients/`.
3. No code change needed — the Signature landing auto-detects them; until then it shows tasteful
   frosted-glass fallback orbs. (Wiring: `INGREDIENTS_BY_DISH` in `src/screens/LandingSignatureDish.tsx`.)
4. Spot-check on the running app: each bubble should read clearly at ~50 px against the pastel dish
   gradients, with **no white or green/magenta halo** around the edges.

---

## Quick QA Checklist

- [ ] Background was one flat pure `#00FF00` or `#FF00FF` (per table) — no gradient/shadow
- [ ] Green foods (mint, basil) + ice used **magenta**, never green
- [ ] No key-colour spill/fringe on the subject's edges or highlights
- [ ] Final file is **PNG with real alpha** (checkerboard shows through), 256×256, centred
- [ ] No halo at a dark-background zoom; ice/cream done via dual white/black if edges look cut
