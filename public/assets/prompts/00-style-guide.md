# Relish — Master Image Style Guide
> Reference this file in every prompt. All assets must conform to these standards.

---

## Brand Colour Palette (LOCKED — never deviate)

| Role | Hex | Usage in image |
|---|---|---|
| Primary Red | `#8B1024` | Plate rim accent line, sauce streaks, chilli elements, dried fruit garnish |
| Accent Red | `#A52030` | Tomato flesh, paprika dust, rose petals, warm gradient shadows |
| Gold / Amber | `#D9A03A` | Olive oil drizzle, caramel sauce, saffron strands, turmeric dust, warm light key colour |
| Cream White | `#FFF8EA` | Surface / background, plate interior, linen napkin, paper backdrop |
| Ink Dark | `#2A1E1E` | Deep bowl interior shadow, espresso coffee, dark chocolate edges |

---

## BASE STYLE BLOCK
*Copy-paste this block verbatim at the start of every prompt, then add dish-specific details below it.*

```
[BASE STYLE]
Surface: cream ivory linen cloth (#FFF8EA), slight fabric texture visible at edges
Plate: matte white ceramic with a fine double-rim line — outer ring #8B1024 (deep red),
       inner ring #D9A03A (gold) — plate diameter fills 70–80% of frame
Light: single warm window light entering from upper-left, colour temperature ~3200 K,
       gold-amber cast on food surfaces, soft shadow trails to lower-right
Colour accents: sauce/chilli/tomato elements read as #A52030 family;
                oil drizzle/caramel/saffron reads as #D9A03A family
Background: #FFF8EA cream, no distracting elements, shallow depth of field on edges
Style: editorial food photography, Michelin-guide quality, ultra-sharp centre,
       photorealistic rendering, no CGI sheen
```

---

## Angle Rules

| Asset type | CSS display size | Generate at (2×) | Required angle |
|---|---|---|---|
| **Thumbnail** | 64 × 64 px | **128 × 128 px** | Overhead flat-lay **OR** 30° tilt — single subject fills 80% of frame, no wasted space |
| **Detail Hero** | 430 × 322 px | **860 × 645 px** | 45° elevated front — full plate visible, rim clearly shows, foreground edge slightly soft-focus for depth |
| **Category Banner** | 430 × 184 px | **860 × 369 px** | Wide 20° overhead — landscape composition, hero dish centred with secondary props flanking |
| **Cover / Poster** | 430 × 764 px | **860 × 1528 px** | Styled scene, vertical portrait, composed like a magazine spread |
| **Deco Portrait** | 430 × 184 px | **860 × 369 px** | Wide 15° overhead, dense arrangement, cinematic crop |
| **Botanica Plate** | 178 × 178 px | **356 × 356 px** | Direct overhead, single plate, geometric centre |

---

## Prompt Construction Rules (apply to every single prompt)

1. **Surface first** — always establish cream linen or ivory ceramic as the first visual layer
2. **Light direction** — "warm window light from upper-left, ~3200 K, gold-amber key, soft shadow lower-right"
3. **Plate grammar** — all plated items use the white ceramic with `#8B1024` / `#D9A03A` double rim unless the dish is in a bowl or glass
4. **Bowl grammar** — soups, risotto use a shallow wide white bowl, same rim treatment
5. **Glass grammar** — beverages use clear glassware, condensation allowed, on a cream coaster
6. **Colour call-outs** — explicitly name the hex for any sauce, drizzle, or garnish that must match the palette
7. **Garnish discipline** — only garnishes authentic to that specific dish; no random microgreens or edible flowers unless the dish actually uses them
8. **No cool tones** — every prompt's negative list must include: `no blue tones, no grey surfaces, no cool lighting, no white LEDs`
9. **No props** — cutlery optional but no hands, no restaurant background, no table text menus
10. **Consistent negative prompt** — always end with the standard negative block below

---

## Standard Negative Prompt (append to every image)

```
Negative: no text, no watermark, no logo, no hands, no fingers,
no cutlery in foreground, no blue tones, no grey surfaces, no cool white lighting,
no dark moody background, no restaurant interior, no people,
no stock-photo style, no oversaturated colours, no CGI sheen
```

---

## Format & Size Reference

| File | CSS size (display) | Generate at 2× | Aspect | Format |
|---|---|---|---|---|
| `[id].webp` | 64 × 64 px | **128 × 128 px** | **1:1** | WebP |
| `[id]-hero.webp` | 430 × 322 px | **860 × 645 px** | **4:3** | WebP |
| `[cat]-banner.webp` | 430 × 184 px | **860 × 369 px** | **21:9** | WebP |
| `cover-classic-poster.webp` | 430 × 764 px | **860 × 1528 px** | **9:16** | WebP |
| `cover-deco-portrait.webp` | 430 × 184 px | **860 × 369 px** | **21:9** | WebP |
| `cover-botanica-plate.webp` | 178 × 178 px | **356 × 356 px** | **1:1** | WebP |

> **Why 2×?** Mobile screens are Retina (2–3× pixel density). Generating at 2× the CSS display
> size ensures sharp images on all iOS/Android devices. The browser/app will scale them down to
> the CSS pixel dimensions automatically via `object-fit: cover` / `img` sizing.

All files live under: `public/assets/dishes/` (dish images) and `public/assets/covers/` (landing screens)

---

## Quality Checklist (run before approving any generated image)

- [ ] Plate rim shows both the red `#8B1024` and gold `#D9A03A` rings
- [ ] Background surface is cream `#FFF8EA` — no grey, no white, no dark
- [ ] Light comes from upper-left with warm gold-amber cast
- [ ] No cool blue or cyan tones anywhere in the image
- [ ] Subject fills ≥ 70% of the frame (thumbnail) or ≥ 60% (hero)
- [ ] Garnish matches the dish — no out-of-place microgreens or flowers
- [ ] No text, no hands, no watermarks visible
- [ ] Oil/sauce accents are clearly warm gold or deep red, not orange or bright yellow
