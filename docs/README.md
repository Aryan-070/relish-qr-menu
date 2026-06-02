# Relish — Documentation

Project docs for the Relish QR Menu platform.

## Commercial
The sales & pricing collateral (also exported as branded PDFs in [`/commercial`](../commercial)).

- [Brochure](commercial/brochure.md) — the sales story, packages, video, how it works.
- [Pricing & Unit Economics](commercial/pricing-and-economics.md) — cost-to-serve, margins, GST, the business case.
- [Comparison](commercial/comparison.md) — Relish vs Petpooja / MENU TIGER / DotPe.

## Engineering
- [Deployment](DEPLOYMENT.md) — deploy to Vercel, and (optional) connect the Supabase backend.

## Source-of-truth files
- Pricing model in code: [`src/console/lib/billing.ts`](../src/console/lib/billing.ts)
- Full plan & cost research: [`/commercial/PLAN.md`](../commercial/PLAN.md), [`/commercial/RESEARCH.md`](../commercial/RESEARCH.md)
- Adjustable pricing sheet: [`/commercial/Relish-Pricing.csv`](../commercial/Relish-Pricing.csv)

> All prices are in INR, exclusive of 18% GST, and are tunable. India market, FX basis ₹86/USD.
