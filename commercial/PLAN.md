# Relish QR Menu — Commercial Packaging Plan (E2E)

> Market: **India (₹ INR)** · FX basis ₹86/USD · Audience: **full kit** (restaurant owners + investors/partners)
> Scope decision: **plan now, build the in-app billing dashboard later**
> All sticker prices are **exclusive of 18% GST** (GST is added on top to the customer).

This plan packages the existing Relish product (a premium, fully-static React/Vite cinematic QR-menu SPA + a 3-role Staff Console) into a sellable commercial offering: pitch, pricing tiers, recurring billing, per-screen video add-ons, a billing dashboard concept, and the brochure/data-sheet deliverables — grounded in real 2025–26 India hosting and competitor numbers.

---

## Phase 0 — Discovery (DONE)

Two evidence-backed fact bases were gathered.

### 0a. Product inventory (what we actually sell) — confidence 95%
- **Guest QR app:** 7 landing/hero themes (Classic + Gastronomique/Editorial/Botanica/Cinematic/Reel/SignatureDish), Menu Booklet, Category pages with ambient animations, Item Detail bottom-sheet, **AI Recommendation flow** (3-question mood/party/budget scorer), Cart/Order panel, **Service Panel** (call waiter, water, split bill, gratuity, Jain info, live request feed). Evidence: `src/screens/*`, `src/components/*`.
- **Staff Console** (`src/console/`): 3 roles — **Admin** (revenue/orders/avg-check/table-turns KPIs, revenue trend, top items, category-mix donut, peak heatmap, busiest tables), **Manager** (16-table floor plan across 4 zones, menu CRUD, staff performance), **Waiter** (my tables, service queue, billing, receipt, order history). localStorage store (`relish.ops.v1`), custom SVG charts. 11 views, 15 components.
- **Media/video system:** network-adaptive rendition picker (`src/lib/pickRendition.ts`), 25 MP4 renditions (9 screens × ~3 bitrates), per-dish tag→video map, GSAP 7.5s hero composition (`public/assets/hero-reel.html`), 6 CSS/SVG category animations, 60+ WebP images. Veo 3.1 prompts archived in `public/assets/prompts/`.
- **3 runtime themes:** Warm / Hybrid / Brutalist.
- **Architecture today:** 100% static SPA, **no backend, no auth, no real persistence** (localStorage demo). This is the single biggest gap for true SaaS billing → see Phase 6.

### 0b. Cost & market research (grounds every number) — sources cited in `RESEARCH.md`
- **Fixed platform cost:** Cloudflare Pages (free static) + Workers ($5) + Supabase Pro ($25) ≈ **₹2,580/mo total** for the whole platform (not per restaurant). INR-native alt: Hostinger VPS ₹599/mo.
- **Video egress is the only variable cost that matters.** Cloudflare **R2 = $0 egress** (unbeatable); Bunny ≈ ₹9/restaurant/mo turnkey; per-minute models (Cloudflare Stream/Mux) get expensive with views; AWS CloudFront India is worst (₹9.37/GB).
- **Cost-to-serve / restaurant / mo:** **₹20 (low) / ₹40 (mid) / ₹210 (high)** — driven by video host choice + view volume.
- **Veo generation (one-time per clip):** ~₹260–520 for an ~8s Veo-3 clip — covered with margin by a one-time production fee.
- **Payment fees (Razorpay):** 2% + 18% GST = **2.36% effective**. **GST: 18% on SaaS, charged on top.**
- **Competitor anchors:** Petpooja ₹625–833/mo (POS+QR bundle), DotPe (transaction-based), MENU TIGER ₹3,268–10,234/mo, myDigiMenu ₹3,354+/mo. **No competitor charges explicitly for video/AI-video → open white space.**

---

## Phase 1 — Pricing model & unit economics

### 1.1 Model — one-time build + nominal annual renewal (NOT per-line-item)
Decision: itemized monthly + per-screen video + hosting is too hard to pitch. Collapse to **one all-inclusive one-time fee** (covers the costly multi-pass AI video gen) + a **nominal annual renewal** priced ~20–30% over cost-to-serve. GST extra on both. Video is **never itemized**; instead, discount the one-time fee when the restaurant supplies its own media.

| Package | One-time (ex-GST) | Renewal/yr (ex-GST) | Video | Who it's for |
|---|---|---|---|---|
| **Web Menu** | ₹15,000 | ₹2,999 | none — **no backend, no dashboard** | Menu-only website (static site) |
| **Classic** | ₹24,999 | ₹2,999 | none (images we make) | Cafés, QSR + staff console |
| **Cinematic** ⭐ | ₹54,999 | ₹4,999 | AI cinematic video across menu + custom hero | Casual & premium dining |
| **Signature** | ₹89,999 | ₹4,999 | full cinematic every screen + white-label + multi-language + AI tuning + annual refresh | Fine-dining / flagship |
| **Multi-location / Chains** | Custom | Custom | full cinematic | 5+ locations, groups |

Renewals: first two (Web Menu, Classic) ₹2,999/yr; Cinematic & Signature ₹4,999/yr. Renewal is now a real high-margin recurring line (cost-to-serve ₹400–1,350/yr), not just break-even.

One-time fee covers the **entire build**: design, menu digitization, dietary tagging, photos &/or AI video, QR table tents, setup, training. Renewal = hosting + support + updates only.

### 1.2 Bring-your-own-media discount (off the one-time fee)
Because AI video (Higgsfield/Veo) rarely lands in one pass, generation is our biggest build COGS. When the client supplies media we skip that cost and pass it back:
- **Client provides dish photos:** −₹3,000
- **Client provides ready videos:** −₹5,000
- **Both:** −₹7,000

Discount is kept small deliberately: we still skip ~₹20k of AI-gen cost, so a BYO-video build is **margin-accretive** while the client still feels rewarded. (Earlier −₹20k video discount was too generous — gave away the value.)

### 1.3 Build & renewal economics
**Build margin (Cinematic ₹54,999):** −₹20,000 AI-video COGS −₹5,000 images/setup/QR/training = **₹29,999 gross profit (~55%)**. Classic ~70%, Signature ~50–65%, Web Menu ~80% (no video, minimal build).

**Renewal margin (high-margin recurring):** Web Menu ₹2,999 vs ₹400 = ~87% · Classic ₹2,999 vs ₹700 = ~77% · Cinematic ₹4,999 vs ₹1,020 = ~80% · Signature ₹4,999 vs ₹1,350 = ~73%. Renewal is now a real recurring revenue stream, not break-even.

### 1.4 Physical & service add-ons (extra revenue lines)
- QR table tents / NFC tags (hardware): ₹99–299/table one-time (resold at margin).
- Professional dish photography (referral/managed): ₹3,000–8,000/shoot.
- Custom theme / bespoke branding: ₹9,999–24,999 one-time.

### 1.5 Unit economics (per restaurant)
- **Build is the revenue engine:** ₹24,999–89,999 one-time at ~55–70% gross margin after AI-video COGS. Upfront cash covers the costly Veo/Higgsfield gen on day one (no months-long recovery).
- **Renewal is nominal:** ₹999–1,999/yr at ~30% over a ₹700–1,350/yr cost-to-serve. Retention, not profit.
- **Cost lever:** AI-video gen passes per clip (build COGS) + video egress (Cloudflare R2 free egress / Bunny). BYO-media discount passes COGS savings back.

### 1.6 Policies to define (don't ship pricing without these)
- **GST:** 18% added on top, shown separately on invoice.
- **Free trial:** 14-day full-feature trial (no card) OR freemium Starter-lite (QR menu only, Relish-branded).
- **Billing cycle:** monthly (Razorpay subscriptions) / annual prepay (2 months free).
- **Cancellation/refund:** 30-day notice, no refund on annual after 14 days, pro-rata on video hosting.
- **Data ownership / DPDP Act 2023 compliance:** menu + order data owned by restaurant; privacy note in contract.

---

## Phase 2 — Pitch & positioning

### 2.1 One-line positioning
**"Relish turns your menu into a cinematic, AI-guided experience — and your floor into a data-driven operation."**

### 2.2 Value pillars (map to brochure sections)
1. **Cinematic guest experience** — 7 designer themes, GSAP hero, per-dish video. Guests *feel* the brand before the first bite.
2. **AI that upsells for you** — mood/budget/party recommender raises average check with zero staff effort.
3. **Tableside service, digitized** — call waiter, water, split bill, gratuity, Jain/allergy info — fewer wait-times, happier tables.
4. **A back-office that pays for itself** — live floor map, menu control, real analytics (peak hours, top items, staff performance).
5. **Premium, but priced for India** — from ₹999/mo, no POS rip-out, live in days.

### 2.3 ROI narrative (for owners)
- +AOV from AI recommend & video (industry: visual menus lift order value 8–15%).
- Staff efficiency from service queue + floor map.
- Zero printing/reprint cost for menu changes.
- Payback: a single ₹999/mo plan ≈ the cost of ~3 reprinted menu sets.

### 2.4 Investor framing (for the economics data sheet)
- 96% gross margin recurring, video as a moat + margin engine.
- TAM: India has 500k+ organized restaurants; QR-menu adoption accelerating post-2020.
- Differentiation: only player monetizing cinematic/AI video as a per-screen line item.

---

## Phase 3 — Sales brochure PDF (deliverable now)
**File:** `commercial/Relish-Brochure.pdf` — audience: restaurant owners.

Sections:
1. Cover — brand, tagline, hero still.
2. The problem (static printed menus, slow service, no data).
3. The Relish experience (5 value pillars, screenshots/mockup callouts).
4. Feature grid (guest app + Staff Console).
5. Pricing tiers table (Starter/Pro/Signature/Enterprise) + "what's included" checkmarks.
6. Video add-on packs.
7. ROI / why now.
8. How it works + onboarding timeline.
9. CTA + contact.

Build via `make-pdf` (HTML→PDF, brand colors: paper/maroon/gold).

## Phase 4 — Internal economics & pricing data sheet PDF (deliverable now)
**File:** `commercial/Relish-Pricing-Economics.pdf` — audience: investors/partners/internal.

Sections:
1. Cost-to-serve model (low/mid/high table).
2. Hosting & video cost tables (with sources).
3. Tier margins & blended unit economics.
4. Payment + GST mechanics.
5. Competitor pricing benchmark table.
6. Sensitivity: view-volume & FX as adjustable inputs.

## Phase 5 — Supporting collateral (normal PDFs / data)
- **One-pager** (`Relish-OnePager.pdf`) — single-sheet leave-behind.
- **Feature comparison matrix** (`Relish-Comparison.pdf`) — Relish vs Petpooja vs MENU TIGER vs DotPe.
- **Pricing data sheet (CSV/XLSX)** — `Relish-Pricing.csv` with FX + view-volume as adjustable inputs so numbers flex against real traffic.

---

## Phase 6 — In-app Billing & Subscription dashboard

> **STATUS (kicked off):** Phase 6.3 (the dashboard VIEW) is **BUILT & verified** — `src/console/views/BillingView.tsx`, new `admin-billing` nav under Admin, wired to the localStorage ops store with the real pricing model in `src/console/lib/billing.ts` (4 packages, 18% GST, one-time + annual renewal). Working: current package, KPIs, next-charge GST breakdown, Renew now, auto-renew toggle, Change plan (with upgrade-difference invoice), invoice history with Paid/Due badges. `tsc -b` + `vite build` green; verified live in preview. Phases 6.1/6.2/6.4 (real backend/auth/Razorpay/metering) remain — the view is honest about it ("Razorpay connects in the next release").

> The Staff Console today is a static localStorage demo. A real billing dashboard needs a backend + auth + payments. This is the phased build plan to execute next.

**Phase 6.1 — Backend & auth foundation**
- Stand up a minimal backend (Supabase recommended: Postgres + Auth + RLS). Replace localStorage demo store with real tables (restaurants, users, plans, subscriptions, video_screens, invoices, usage).
- Add auth to the Staff Console entry (replace `#staff` hash-route demo). Roles map to Supabase RLS policies.
- Verification: a real login persists across sessions; data survives refresh.

**Phase 6.2 — Razorpay subscriptions integration**
- Razorpay Subscriptions API: plans (Starter/Pro/Signature), add-ons (video screens), GST 18% as a tax line. Webhooks → invoices table.
- Verification: a test-mode subscription creates an invoice row; webhook updates status.

**Phase 6.3 — Billing dashboard view (new Console view: `admin-billing`)**
- New nav item under Admin: **Billing & Subscription**.
- Cards: current plan, next renewal date, MRR, usage (active video screens, video bandwidth this cycle vs included), payment method.
- Tables: invoice history (download PDF), add-on management (add/remove video screens → live price delta), upgrade/downgrade plan (proration preview).
- Reuse existing console components: `KpiCard`, `DataTable`, `Panel`, `SegmentedControl`, `Modal`, `Toast`.
- Verification: changing screens updates the projected monthly total live; invoice list renders from backend.

**Phase 6.4 — Usage metering for video**
- Meter video egress per restaurant (Cloudflare/Bunny logs → usage table) to bill overage beyond included screens and prove cost-to-serve.
- Verification: a known number of plays produces a matching bandwidth figure in the dashboard.

**Anti-patterns to avoid in Phase 6**
- Don't invent Razorpay API fields — follow current Razorpay Subscriptions docs.
- Don't store card data; use Razorpay tokenization.
- Don't break the existing guest SPA's zero-backend deploy — billing backend is a separate service the Console talks to.

---

## Phase 7 — Verification
- [ ] Every price in brochure matches `RESEARCH.md` cost basis and leaves stated margin.
- [ ] GST (18%) and payment fee (2.36%) reflected in economics sheet.
- [ ] Brochure claims map only to **implemented** features (Phase 0a); roadmap features labeled "coming soon".
- [ ] Competitor figures cited with sources.
- [ ] PDFs render correctly (fonts, brand colors, tables not clipped).
- [ ] Pricing CSV opens with FX + view-volume as editable inputs.

---

## Gaps the brief didn't mention — now covered
1. **One-time setup/onboarding fee** (added — Phase 1.2).
2. **GST 18% on top** + **2.36% payment fee** (added — pricing must state these).
3. **Free trial / freemium** decision (added — Phase 1.6).
4. **Annual vs monthly + discount** (added — 2 months free on annual).
5. **Multi-location/chain pricing** (added — Enterprise tier).
6. **White-label** option (added — Signature).
7. **Physical add-ons** (QR tents, NFC) and **photography** as revenue lines (added — Phase 1.4).
8. **Backend/auth/payments reality** for real billing (added — Phase 6; today's app is static).
9. **DPDP Act 2023 / data ownership** (added — Phase 1.6).
10. **Cancellation/refund policy** (added — Phase 1.6).
11. **Reseller/agency program** (flag for later — channel for India SMB reach).
