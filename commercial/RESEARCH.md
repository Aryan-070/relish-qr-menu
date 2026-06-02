# Relish — Grounded Cost & Market Research (India, 2025–26)

FX basis: **₹86 / USD**. All sticker prices **ex-GST** (SaaS GST = 18%, on top).
Confidence + sources noted per row. This is the evidence base for `PLAN.md` pricing.

## 1. Cloud hosting (monthly) — non-video infra is near-free at our scale
| Provider / Tier | USD | INR | What you get | Conf. |
|---|---|---|---|---|
| Cloudflare Pages (Free) | $0 | ₹0 | **Unlimited static bandwidth**, 500 builds/mo | High |
| Cloudflare Workers (Paid) | $5 | ₹430 | 10M req for small backend/API | High |
| Vercel Pro | $20/user | ₹1,720 | 1 TB transfer incl; overage $0.15/GB | High |
| Netlify Pro | $19/member | ₹1,634 | ~1 TB incl; overage ~$0.55/GB | Med |
| AWS S3+CloudFront | ~$5–20 | ₹430–1,720 | 1 TB CF egress free; India edge $0.109/GB after | High |
| AWS Lightsail (2GB) | $12 | ₹1,032 | Small VPS, Mumbai region | High |
| Hostinger India KVM VPS | — | ₹599–1,500 | Root NVMe VPS, INR-native | High |
| DigitalOcean Droplet | $4–6 | ₹344–516 | Basic droplet (Bangalore) | High |
| Supabase Pro | $25 | ₹2,150 | 8GB DB, 100GB storage, 100K MAU, auth | High |
| Neon Postgres | $5+ | ₹430+ | $0.35/GB-mo, scale-to-zero | High |

**Whole-platform fixed cost ≈ ₹2,580/mo** (CF Pages free + Workers $5 + Supabase $25). Amortized across the restaurant base → trivial per-restaurant.

## 2. Video streaming (the only variable that matters)
| Provider | Storage | Delivery (egress) | Notes | Conf. |
|---|---|---|---|---|
| **Cloudflare R2** | $0.015/GB | **$0 (FREE egress)** | Self-host MP4/HLS → unbeatable | High |
| **Bunny Stream/CDN** | $0.01/GB | $0.005/GB (₹0.43) | Turnkey, $1/mo min | High |
| Cloudflare Stream | $5/1000 min stored | $1/1000 min delivered | Per-minute, costly at high views | High |
| Mux | $0.0024/min | $0.0008/min (720p) | 100K free min/mo | High |
| AWS CloudFront (India) | (S3 $0.025/GB) | $0.109/GB (₹9.37) | Worst for video egress | High |

**Worked example** (10 clips/restaurant, ~10s/3MB each, ~20 GB egress/mo):
R2 ≈ ₹0 · Bunny ≈ ₹9 · Mux ≈ ₹114 · CF Stream ≈ ₹144 · CloudFront ≈ ₹187.
*View-volume (10K plays/restaurant/mo) is an estimate — biggest swing factor; remodel vs real traffic.*

## 3. Veo generation (one-time, per clip)
~$0.40–0.75/sec → an 8s Veo-3 clip ≈ **₹260–520**. Covered with margin by the one-time video production fee (₹1,999/screen).

## 4. Self-hosted / on-prem (single-restaurant LAN kiosk only)
Mini-PC ₹18–30k one-time (₹500–830/mo amortized) + electricity ~₹90 + business internet ₹800–1,500 = **~₹1,400–2,400/mo**. No SLA. Makes no sense vs ₹599 VPS / free CF Pages for multi-tenant SaaS — only for an offline on-site kiosk.

## 5. Payment + GST
- **Razorpay:** 2% + 18% GST = **2.36% effective** domestic. No setup/AMC.
- **GST on SaaS = 18%**, charged on top of sticker (₹500 plan → ₹590 to customer). Registration mandatory > ₹20 lakh turnover.

## 6. Competitor pricing benchmark (India)
| Product | Model | Price | Conf. |
|---|---|---|---|
| Petpooja (POS+QR) | Annual | ₹10,000 yr1, ₹7,500/yr after (~₹625–833/mo) | High |
| DotPe | Transaction | No fixed fee, pay-per-txn | High |
| MENU TIGER | SaaS USD | $38–119/mo (₹3,268–10,234) | High |
| myDigiMenu | SaaS USD | $39–179/mo (₹3,354+), no free tier in India | High |
| UpMenu | SaaS | ~$49/mo (₹4,214) | Med |
| Flipdish | SaaS | €49–79/mo (₹4,500–7,300) | Med |
| Qup / Scanizer / Bzaar | quote-only | Not public | Low (gap) |

**Insight:** Indian POS-bundled QR anchors at ₹625–833/mo; international pure-QR SaaS is 4–12× that. **No one charges explicitly for cinematic/AI video → Relish's white space.**

## 7. Cost-to-serve synthesis (/restaurant/mo)
| Scenario | Fixed÷base | Video egress | Payment (on ₹600) | **Total** |
|---|---|---|---|---|
| LOW (500 rest, R2) | ₹5 | ₹1 | ₹14 | **~₹20** |
| MID (150 rest, Bunny) | ₹17 | ₹9 | ₹14 | **~₹40** |
| HIGH (50 rest, CF Stream) | ₹52 | ₹144 | ₹14 | **~₹210** |

## Sources
Vercel pricing · Cloudflare R2/Stream/Pages/Workers pricing · Bunny Stream/CDN/Storage pricing · Mux pricing · AWS CloudFront/Lightsail pricing · Supabase pricing · Neon (Bytebase comparison) · Hostinger India VPS · DigitalOcean droplets · Razorpay pricing blog · Petpooja pricing/G2 · DotPe comparisons · MENU TIGER pricing · myDigiMenu pricing. (Full URLs in research agent transcript.)
