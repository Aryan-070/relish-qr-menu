# Relish — Pricing & Unit Economics

> Market: India (₹ INR) · FX basis ₹86/USD · Scale frame 50–500 restaurants · All sticker prices ex-GST.
> *Branded PDF: [`/commercial/Relish-Pricing-Economics.pdf`](../../commercial/Relish-Pricing-Economics.pdf) · Adjustable model: [`/commercial/Relish-Pricing.csv`](../../commercial/Relish-Pricing.csv)*

## The thesis: money in the build, recurring in the renewal

Relish charges a single all-inclusive **one-time fee** to design, build and launch the menu — including the costly, multi-pass AI video generation. The **annual renewal** (₹2,999–4,999/yr) keeps the menu hosted, supported and updated; because cost-to-serve is tiny, it's high-margin recurring on top of the build.

| Metric | Value |
|---|---|
| One-time go-live fee | ₹15,000 – ₹90,000 per restaurant |
| Gross margin on the build (after AI-video COGS) | 55–70% |
| Margin on the ₹2,999–4,999/yr renewal | 75–87% |
| Video egress on Cloudflare R2 | ₹0 (the hosting cost lever) |

**The wedge:** no competitor in India bundles cinematic / AI-generated video into a clean one-time price. Relish absorbs the expensive part (video that rarely lands in one pass) and gives only a small discount when the restaurant supplies its own media — so a bring-your-own-video build is our **highest-margin job**.

## Packages

| Package | One-time | Renewal/yr | Video | Segment |
|---|---|---|---|---|
| Web Menu | ₹15,000 | ₹2,999 | None · no dashboard | Menu-only website, no backend |
| Classic | ₹24,999 | ₹2,999 | None (images) | Café / QSR + staff console |
| Cinematic ⭐ | ₹54,999 | ₹4,999 | AI video menu | Casual & premium dining |
| Signature | ₹89,999 | ₹4,999 | Full cinematic | Fine-dining / flagship |

## Build economics — Cinematic package

| Line | INR (one-time) |
|---|---|
| Go-live fee | ₹54,999 |
| COGS — AI video generation (Higgsfield / Veo, multi-pass) | −₹20,000 |
| COGS — images, setup, QR, training | −₹5,000 |
| **Build gross profit** | **₹29,999 · ~55%** |

## Bring-your-own-media discount

| Client provides | Off one-time |
|---|---|
| Dish photos (we skip image work) | −₹3,000 |
| Ready videos (we skip costly AI gen) | −₹5,000 |
| Both | −₹7,000 |

The discount is kept small while we save ~₹20k of generation cost — so BYO-video is margin-accretive, and the client still feels rewarded.

## Renewal economics (recurring)

| Renewal / yr | Cost-to-serve / yr | Margin |
|---|---|---|
| Web Menu ₹2,999 | ₹400 | ~87% |
| Classic ₹2,999 | ₹700 | ~77% |
| Cinematic ₹4,999 | ₹1,020 | ~80% |
| Signature ₹4,999 | ₹1,350 | ~73% |

## Cost-to-serve per restaurant / year

| Package | Hosting + infra | Video egress | Support | Total / yr |
|---|---|---|---|---|
| Web Menu (no dashboard) | ₹120 | ₹0 | ₹280 | ~₹400 |
| Classic | ₹200 | ₹0 | ₹500 | ~₹700 |
| Cinematic (R2 / Bunny) | ₹300 | ₹120 | ₹600 | ~₹1,020 |
| Signature (heavy video) | ₹400 | ₹250 | ₹700 | ~₹1,350 |

Whole-platform fixed cost ≈ ₹2,580/mo (Cloudflare Pages free + Workers + Supabase), amortized across the base. Video egress is the only variable that scales — serve short clips from **Cloudflare R2 (free egress)** or Bunny; avoid per-minute models (Stream/Mux) and the India CloudFront edge.

## Payment & GST

| Item | Rate | Effect |
|---|---|---|
| Razorpay domestic | 2% + 18% GST on the fee | ≈ 2.36% effective off the top |
| GST on the build & renewal | 18% | Added on top; ₹54,999 build → ₹64,899 to the customer |
| GST registration threshold (services) | ₹20 lakh turnover | Mandatory above |

## Competitor benchmark (India)

| Product | Model | INR |
|---|---|---|
| Petpooja (POS + QR) | Monthly | ₹625–833/mo |
| MENU TIGER | Monthly SaaS | ₹3,268–10,234/mo |
| myDigiMenu | Monthly SaaS | ₹3,354+/mo |
| DotPe | Per-transaction | variable |
| **Relish** | **One-time + annual renewal** | **₹15,000–89,999 + ₹2,999–4,999/yr** |

Competitors sell monthly SaaS; Relish's one-time build + nominal-renewal shape is the differentiator — premium on the build, near-free to keep, and alone in bundling video.

## Sensitivity — levers to watch
- **AI-video gen passes / clip (~5–10):** the biggest COGS swing on the build.
- **BYO-media take rate:** cuts our COGS as much as the quote; protects margin.
- **FX rate (₹86/USD):** moves every USD-priced gen & hosting line.
- **Video host (R2 / Bunny):** ₹0 vs ₹187 per restaurant — the renewal cost lever.
