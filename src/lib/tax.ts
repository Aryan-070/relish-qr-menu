/**
 * tax.ts — pure, dependency-free tax engine for Relish's India-first, global-ready POS.
 *
 * Phase 3 groundwork: a later billing/checkout UI consumes this. There is no I/O,
 * no formatting, and no framework here — only deterministic, immutable math over
 * plain numbers so it is trivial to unit-test and reuse on server or client.
 *
 * ## Money convention
 * Prices are integers in the **major unit** (e.g. `320` means ₹320), matching
 * {@link module:money}. Tax component amounts are rounded to whole rupees by
 * default (see {@link roundComponents}) to mirror the app's whole-rupee INR
 * convention, while the breakdown is guaranteed to sum **exactly** to the tax
 * total (any rounding residual is folded into the largest component).
 *
 * ## Regimes
 * - `gst`  — Indian GST. Intra-state splits into CGST + SGST (each `pct/2`);
 *            inter-state uses a single IGST at the full `pct`.
 * - `vat`  — a single flat tax component (EU/UK/Gulf style). No split.
 * - `none` — tax-free; `taxTotal` is `0` and `grandTotal` equals the base.
 *
 * ## Inclusive vs exclusive
 * - **Exclusive** (`pricesIncludeTax: false`): tax is added on top of the base.
 *   `grandTotal = base + tax`.
 * - **Inclusive** (`pricesIncludeTax: true`): the listed price already contains
 *   tax. We *extract* it: `taxableBase = gross / (1 + pct/100)`,
 *   `taxTotal = gross - taxableBase`, `grandTotal = gross`.
 *
 * @example Exclusive GST on a ₹1,000 intra-state bill at 5%
 *   computeBillTax(1000, DEFAULT_TAX_CONFIG)
 *   // taxableBase 1000, components [CGST 2.5% ₹25, SGST 2.5% ₹25],
 *   // taxTotal 50, grandTotal 1050
 *
 * @example Inclusive 18% AC restaurant price of ₹118
 *   computeBillTax(118, { ...DEFAULT_TAX_CONFIG, defaultRatePct: 18, pricesIncludeTax: true })
 *   // taxableBase 100, taxTotal 18, grandTotal 118
 */

/** Tax system in force for a venue. See module docs for semantics. */
export type TaxRegime = 'gst' | 'vat' | 'none'

/** A named tax rate the operator can pick from (e.g. a GST slab). */
export interface TaxRate {
  /** Stable identifier, safe for use as a select-option value. */
  id: string
  /** Human-readable label for UI menus. */
  label: string
  /** Rate as a percentage (e.g. `5` means 5%). */
  pct: number
}

/**
 * Common Indian GST slabs.
 *
 * Restaurant food service is typically **5% GST without ITC**; `18%` is included
 * for packaged goods and AC/licensed-bar establishments where it applies. `0%`
 * (exempt) and `12%` round out the everyday slabs a small venue will encounter.
 */
export const GST_RATES: readonly TaxRate[] = [
  { id: 'gst-0', label: 'GST 0% (exempt)', pct: 0 },
  { id: 'gst-5', label: 'GST 5% (restaurant, no ITC)', pct: 5 },
  { id: 'gst-12', label: 'GST 12%', pct: 12 },
  { id: 'gst-18', label: 'GST 18% (AC / packaged)', pct: 18 },
]

/** The default restaurant GST rate (5%, food service without ITC). */
export const DEFAULT_GST_RATE_PCT = 5

/** Venue-level tax configuration consumed by the compute functions. */
export interface TaxConfig {
  /** Which tax system applies. */
  regime: TaxRegime
  /** Fallback rate (percent) when a line item does not specify its own. */
  defaultRatePct: number
  /** `true` if listed prices already include tax (extract); `false` to add on top. */
  pricesIncludeTax: boolean
  /** `true` for inter-state GST (IGST); `false` for intra-state (CGST + SGST). */
  interState: boolean
}

/**
 * Sensible India-first default: 5% GST, prices exclusive of tax, intra-state.
 * Use this instead of hardcoding a config so a future change is one line.
 */
export const DEFAULT_TAX_CONFIG: TaxConfig = {
  regime: 'gst',
  defaultRatePct: DEFAULT_GST_RATE_PCT,
  pricesIncludeTax: false,
  interState: false,
}

/** A single line of a tax breakdown (e.g. `CGST 2.5% → ₹25`). */
export interface TaxComponent {
  /** Display label, e.g. `'CGST'`, `'SGST'`, `'IGST'`, `'VAT'`. */
  label: string
  /** The percentage this component represents (e.g. `2.5`). */
  pct: number
  /** The component's tax amount in major units (rounded by {@link roundComponents}). */
  amount: number
}

/** The full, UI-ready result of a tax computation. */
export interface TaxBreakdown {
  /** Net amount the tax is charged on (pre-tax), in major units. */
  taxableBase: number
  /** Itemized tax lines that sum exactly to {@link TaxBreakdown.taxTotal}. */
  components: TaxComponent[]
  /** Total tax across all components, in major units. */
  taxTotal: number
  /** Amount payable: `taxableBase + taxTotal`, in major units. */
  grandTotal: number
  /** Whether the source price was tax-inclusive (echoed for UI clarity). */
  pricesIncludeTax: boolean
}

/**
 * Coerce arbitrary numeric input to a safe, finite, non-negative number.
 * Guards `NaN`/`Infinity`/negatives (which are meaningless for a bill) to `0`.
 */
function safe(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** Round half-up to whole rupees. `Math.round` already rounds .5 up. */
function roundRupees(value: number): number {
  return Math.round(value)
}

/**
 * Round each component's amount to whole rupees while preserving the invariant
 * that the components sum **exactly** to `taxTotal`.
 *
 * Each amount is rounded independently, then the residual (`taxTotal` minus the
 * sum of rounded amounts) is added to the **largest** component so totals always
 * reconcile to the penny — the standard "largest remainder" reconciliation.
 *
 * @param components Raw components with unrounded `amount`s.
 * @param taxTotal   The exact total the rounded amounts must sum to.
 * @returns          New components (immutable copy) summing exactly to `taxTotal`.
 *
 * @example Two components of 12.5 with a total of 25
 *   roundComponents([{ label: 'CGST', pct: 2.5, amount: 12.5 },
 *                    { label: 'SGST', pct: 2.5, amount: 12.5 }], 25)
 *   // → CGST 13, SGST 12 (sum 25), residual folded into the first/largest
 */
export function roundComponents(
  components: readonly TaxComponent[],
  taxTotal: number,
): TaxComponent[] {
  if (components.length === 0) {
    return []
  }

  const target = roundRupees(taxTotal)
  const rounded = components.map((c) => ({ ...c, amount: roundRupees(c.amount) }))
  const sum = rounded.reduce((acc, c) => acc + c.amount, 0)
  const residual = target - sum

  if (residual === 0) {
    return rounded
  }

  // Fold the residual into the component with the largest amount so the
  // adjustment is proportionally least noticeable.
  let largestIdx = 0
  for (let i = 1; i < rounded.length; i += 1) {
    if (rounded[i].amount > rounded[largestIdx].amount) {
      largestIdx = i
    }
  }

  return rounded.map((c, i) =>
    i === largestIdx ? { ...c, amount: c.amount + residual } : c,
  )
}

/**
 * Split a GST tax amount into its statutory components.
 *
 * - **Intra-state** (`interState: false`): two equal halves — CGST + SGST, each
 *   at `pct/2`. This is the common case for a single-state restaurant.
 * - **Inter-state** (`interState: true`): a single IGST line at the full `pct`.
 *
 * Amounts are split from the *unrounded* `taxAmount` and then reconciled via
 * {@link roundComponents}, so CGST + SGST always sum exactly to `taxAmount`
 * (rounded). A `0` tax amount or `0` pct yields an empty component list.
 *
 * @param taxAmount  Total GST in major units (unrounded is fine).
 * @param pct        The full GST rate (e.g. `5`, `18`).
 * @param interState `true` → IGST; `false` → CGST + SGST.
 * @returns          Component lines summing exactly to `round(taxAmount)`.
 *
 * @example Intra-state 5% on ₹50 of tax
 *   splitGst(50, 5, false) // [CGST 2.5% ₹25, SGST 2.5% ₹25]
 *
 * @example Inter-state 18% on ₹90 of tax
 *   splitGst(90, 18, true) // [IGST 18% ₹90]
 */
export function splitGst(
  taxAmount: number,
  pct: number,
  interState: boolean,
): TaxComponent[] {
  const amount = safe(taxAmount)
  const rate = safe(pct)

  if (amount === 0 || rate === 0) {
    return []
  }

  if (interState) {
    return roundComponents([{ label: 'IGST', pct: rate, amount }], amount)
  }

  const half = amount / 2
  const rawComponents: TaxComponent[] = [
    { label: 'CGST', pct: rate / 2, amount: half },
    { label: 'SGST', pct: rate / 2, amount: half },
  ]

  return roundComponents(rawComponents, amount)
}

/**
 * Build the component list for a single-rate bill given its raw tax amount,
 * honouring the configured regime (GST split, flat VAT, or none).
 */
function componentsForRegime(
  taxAmount: number,
  pct: number,
  config: Readonly<TaxConfig>,
): TaxComponent[] {
  const amount = safe(taxAmount)
  const rate = safe(pct)

  if (config.regime === 'none' || amount === 0 || rate === 0) {
    return []
  }

  if (config.regime === 'gst') {
    return splitGst(amount, rate, config.interState)
  }

  // VAT (and any future flat regime): a single line at the full rate.
  return roundComponents([{ label: 'VAT', pct: rate, amount }], amount)
}

/**
 * Compute tax **on top of** a tax-exclusive base.
 *
 * `tax = base * pct/100`, `grandTotal = base + tax`. The base is treated as the
 * taxable amount as-is. Respects the regime for component splitting.
 *
 * @param base   Tax-exclusive amount in major units.
 * @param pct    Tax rate as a percentage.
 * @param config Venue config (used for regime + inter-state split).
 * @returns      A {@link TaxBreakdown} with `pricesIncludeTax: false`.
 *
 * @example
 *   computeTaxExclusive(1000, 5, DEFAULT_TAX_CONFIG)
 *   // taxableBase 1000, taxTotal 50, grandTotal 1050
 */
export function computeTaxExclusive(
  base: number,
  pct: number,
  config: Readonly<TaxConfig>,
): TaxBreakdown {
  const taxableBase = safe(base)
  const rate = config.regime === 'none' ? 0 : safe(pct)
  const rawTax = (taxableBase * rate) / 100
  const components = componentsForRegime(rawTax, rate, config)
  const taxTotal = components.reduce((acc, c) => acc + c.amount, 0)

  return {
    taxableBase,
    components,
    taxTotal,
    grandTotal: taxableBase + taxTotal,
    pricesIncludeTax: false,
  }
}

/**
 * Extract tax that is **already inside** a gross (tax-inclusive) price.
 *
 * `taxableBase = gross / (1 + pct/100)`, `taxTotal = gross - taxableBase`,
 * `grandTotal = gross`. The taxable base is rounded to whole rupees and the tax
 * total is derived as `gross - roundedBase` so that `base + tax === gross`
 * exactly, then components are split from that exact tax total.
 *
 * @param gross  Tax-inclusive amount in major units.
 * @param pct    Tax rate as a percentage.
 * @param config Venue config (used for regime + inter-state split).
 * @returns      A {@link TaxBreakdown} with `pricesIncludeTax: true`.
 *
 * @example 18% inclusive: ₹118 gross → ₹100 base + ₹18 tax
 *   extractTaxInclusive(118, 18, DEFAULT_TAX_CONFIG)
 *   // taxableBase 100, taxTotal 18, grandTotal 118
 */
export function extractTaxInclusive(
  gross: number,
  pct: number,
  config: Readonly<TaxConfig>,
): TaxBreakdown {
  const grandTotal = safe(gross)
  const rate = config.regime === 'none' ? 0 : safe(pct)

  if (rate === 0 || grandTotal === 0) {
    return {
      taxableBase: grandTotal,
      components: [],
      taxTotal: 0,
      grandTotal,
      pricesIncludeTax: true,
    }
  }

  const taxableBase = roundRupees(grandTotal / (1 + rate / 100))
  const taxTotal = grandTotal - taxableBase
  const components = componentsForRegime(taxTotal, rate, config)

  return {
    taxableBase,
    components,
    taxTotal,
    grandTotal,
    pricesIncludeTax: true,
  }
}

/**
 * Compute a full tax breakdown for a single subtotal, picking inclusive vs
 * exclusive math from `config.pricesIncludeTax` and the component shape (GST
 * split / flat VAT / none) from `config.regime`.
 *
 * This is the primary entry point for a "one tax rate for the whole bill"
 * checkout. For mixed per-item rates use {@link computeLineItemsTax}.
 *
 * @param subtotal        The bill subtotal in major units. When the config is
 *                        inclusive this is the gross; otherwise it is the net base.
 * @param config          Venue tax config. Defaults to {@link DEFAULT_TAX_CONFIG}.
 * @param rateOverridePct Optional rate to use instead of `config.defaultRatePct`
 *                        (e.g. an item-category override applied to the whole bill).
 * @returns               A reconciled {@link TaxBreakdown}.
 *
 * @example Exclusive default (5% intra-state) on ₹1,000
 *   computeBillTax(1000) // taxTotal 50, grandTotal 1050
 *
 * @example Tax-free venue
 *   computeBillTax(1000, { ...DEFAULT_TAX_CONFIG, regime: 'none' })
 *   // taxTotal 0, grandTotal 1000
 */
export function computeBillTax(
  subtotal: number,
  config: Readonly<TaxConfig> = DEFAULT_TAX_CONFIG,
  rateOverridePct?: number,
): TaxBreakdown {
  const pct =
    config.regime === 'none'
      ? 0
      : rateOverridePct ?? config.defaultRatePct

  return config.pricesIncludeTax
    ? extractTaxInclusive(subtotal, pct, config)
    : computeTaxExclusive(subtotal, pct, config)
}

/** A bill line for {@link computeLineItemsTax}: an amount and an optional rate. */
export interface TaxLineItem {
  /** The line amount in major units (gross if inclusive, net if exclusive). */
  amount: number
  /** Optional per-line rate (percent). Falls back to `config.defaultRatePct`. */
  ratePct?: number
}

/**
 * Aggregate tax across line items that may carry **different** rates.
 *
 * Each item is taxed at its own `ratePct` (or `config.defaultRatePct`), using
 * inclusive or exclusive math per the config. Items are grouped by `(label, pct)`
 * so the returned breakdown has one merged component per distinct rate-component
 * (e.g. all 5% lines contribute to a single `CGST 2.5%` line, all 18% lines to a
 * separate `CGST 9%` line). The merged components are then re-reconciled so they
 * sum exactly to the aggregate tax total.
 *
 * @param items  Line items to tax. Each amount is guarded to `0` if invalid.
 * @param config Venue tax config. Defaults to {@link DEFAULT_TAX_CONFIG}.
 * @returns      A {@link TaxBreakdown} aggregating every line.
 *
 * @example Mixed 5% and 18% lines (intra-state, exclusive)
 *   computeLineItemsTax(
 *     [{ amount: 1000, ratePct: 5 }, { amount: 1000, ratePct: 18 }],
 *     DEFAULT_TAX_CONFIG,
 *   )
 *   // taxableBase 2000, components [CGST 2.5% ₹25, SGST 2.5% ₹25,
 *   //   CGST 9% ₹90, SGST 9% ₹90], taxTotal 230, grandTotal 2230
 */
export function computeLineItemsTax(
  items: readonly TaxLineItem[],
  config: Readonly<TaxConfig> = DEFAULT_TAX_CONFIG,
): TaxBreakdown {
  const perLine = items.map((item) =>
    computeBillTax(safe(item.amount), config, item.ratePct),
  )

  const taxableBase = perLine.reduce((acc, b) => acc + b.taxableBase, 0)
  const taxTotal = perLine.reduce((acc, b) => acc + b.taxTotal, 0)

  // Merge components sharing the same (label, pct) so the UI shows one line per
  // distinct rate-component rather than one per item.
  const merged = new Map<string, TaxComponent>()
  for (const breakdown of perLine) {
    for (const component of breakdown.components) {
      const key = `${component.label}@${component.pct}`
      const existing = merged.get(key)
      merged.set(
        key,
        existing
          ? { ...existing, amount: existing.amount + component.amount }
          : { ...component },
      )
    }
  }

  const components = roundComponents([...merged.values()], taxTotal)
  const reconciledTotal = components.reduce((acc, c) => acc + c.amount, 0)

  return {
    taxableBase,
    components,
    taxTotal: reconciledTotal,
    grandTotal: taxableBase + reconciledTotal,
    pricesIncludeTax: config.pricesIncludeTax,
  }
}
