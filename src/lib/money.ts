/**
 * money.ts — locale-aware, multi-currency money formatting for Relish.
 *
 * The app is India-first but global-ready. Prices are stored as plain integers
 * in the **major unit** (e.g. `320` means ₹320, `12` means $12). For INR we use
 * a whole-rupee convention (no paise / no decimals), matching how the UI renders
 * prices today via `₹{amount.toLocaleString('en-IN')}`.
 *
 * This module wraps the built-in `Intl.NumberFormat` (no external dependencies)
 * and degrades gracefully to a manual `symbol + grouped number` fallback if a
 * given runtime/locale combination throws.
 *
 * @example Drop-in for the current `₹{amount}` rendering
 *   formatMoney(1200)                 // "₹1,200"
 *   formatMoney(320)                  // "₹320"
 *   formatMoney(1200, 'INR')          // "₹1,200"
 *
 * @example Other currencies
 *   formatMoney(12, 'USD')            // "$12.00"
 *   formatMoney(1999, 'EUR')          // "€1,999.00" (en-IE grouping)
 *   formatMoney(50, 'GBP')            // "£50.00"
 *
 * @example Symbol-less (decimal) output
 *   formatMoney(1200, 'INR', { withSymbol: false })  // "1,200"
 *
 * @example Styling the symbol separately (used by the Price atom)
 *   const { symbol, value } = formatMoneyParts(1200) // { symbol: "₹", value: "1,200" }
 */

/**
 * Supported ISO 4217 currency codes.
 *
 * Extensible: add a new code here and a matching entry in {@link CURRENCIES}.
 */
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD'

/**
 * Static metadata for a supported currency.
 *
 * - `symbol`     — display symbol used for the manual fallback and for
 *                  {@link formatMoneyParts}.
 * - `locale`     — BCP 47 locale that drives digit grouping and separators
 *                  (e.g. `en-IN` produces the lakh/crore grouping `12,34,567`).
 * - `minorUnits` — number of fractional digits the currency renders. INR uses
 *                  `0` here to honour the app's whole-rupee convention, even
 *                  though ISO technically allows 2 (paise).
 */
export interface CurrencyMeta {
  readonly symbol: string
  readonly locale: string
  readonly minorUnits: number
}

/**
 * Registry of supported currencies and their display metadata.
 *
 * `INR.minorUnits` is intentionally `0` to match Relish's whole-rupee pricing
 * (no paise). All other currencies use their conventional 2 decimal places.
 */
export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyMeta>> = {
  INR: { symbol: '₹', locale: 'en-IN', minorUnits: 0 },
  USD: { symbol: '$', locale: 'en-US', minorUnits: 2 },
  EUR: { symbol: '€', locale: 'en-IE', minorUnits: 2 },
  GBP: { symbol: '£', locale: 'en-GB', minorUnits: 2 },
  AED: { symbol: 'د.إ', locale: 'en-AE', minorUnits: 2 },
  SGD: { symbol: 'S$', locale: 'en-SG', minorUnits: 2 },
}

/**
 * Default currency for the India-first app. Use this instead of hardcoding
 * `'INR'` at call sites so a future global default is a one-line change.
 */
export const DEFAULT_CURRENCY: CurrencyCode = 'INR'

/** Options accepted by {@link formatMoney} and {@link formatMoneyParts}. */
export interface FormatMoneyOptions {
  /**
   * Include the currency symbol. When `true` (default) the output uses
   * `Intl` currency style (e.g. `₹1,200`). When `false`, only the grouped
   * number is returned (e.g. `1,200`).
   */
  withSymbol?: boolean
  /**
   * Override the locale used for grouping/separators. Defaults to the
   * currency's configured locale (e.g. `en-IN` for INR).
   */
  locale?: string
}

/**
 * Resolve a currency's metadata, falling back to {@link DEFAULT_CURRENCY} for
 * any unknown code so callers never crash on bad data.
 */
function resolveMeta(currency: CurrencyCode): CurrencyMeta {
  return CURRENCIES[currency] ?? CURRENCIES[DEFAULT_CURRENCY]
}

/**
 * Coerce arbitrary numeric input into a safe, finite number. Guards against
 * `NaN`/`Infinity` leaking into the formatter (which would render literally).
 */
function safeAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0
}

/**
 * Manual fallback used when `Intl` throws for an exotic locale or unsupported
 * environment. Produces `symbol + grouped number` with the currency's minor
 * units, using a plain `en-US`-style grouping as a last resort.
 */
function manualFormat(
  amount: number,
  meta: CurrencyMeta,
  withSymbol: boolean,
): string {
  const fixed = amount.toFixed(meta.minorUnits)
  const [intPart, fracPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const value = fracPart ? `${grouped}.${fracPart}` : grouped
  return withSymbol ? `${meta.symbol}${value}` : value
}

/**
 * Format a major-unit integer amount as a localized currency string.
 *
 * The INR default reproduces the app's current `₹{amount.toLocaleString('en-IN')}`
 * output exactly — en-IN grouping, no decimals — so this is a drop-in replacement.
 *
 * @param amount   Amount in the currency's **major unit** (e.g. `1200` → ₹1,200).
 * @param currency Currency code. Defaults to {@link DEFAULT_CURRENCY} (`INR`).
 * @param opts     Formatting options. See {@link FormatMoneyOptions}.
 * @returns        A localized string such as `"₹1,200"`, `"$12.00"`, or `"1,200"`.
 *
 * @example
 *   formatMoney(1200)                          // "₹1,200"
 *   formatMoney(12, 'USD')                     // "$12.00"
 *   formatMoney(1200, 'INR', { withSymbol: false }) // "1,200"
 */
export function formatMoney(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  opts?: FormatMoneyOptions,
): string {
  const meta = resolveMeta(currency)
  const value = safeAmount(amount)
  const withSymbol = opts?.withSymbol ?? true
  const locale = opts?.locale ?? meta.locale

  try {
    if (withSymbol) {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: meta.minorUnits,
        maximumFractionDigits: meta.minorUnits,
      }).format(value)
    }

    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: meta.minorUnits,
      maximumFractionDigits: meta.minorUnits,
    }).format(value)
  } catch {
    // Exotic/unsupported locale — degrade to manual symbol + grouped number.
    return manualFormat(value, meta, withSymbol)
  }
}

/** Structured result returned by {@link formatMoneyParts}. */
export interface MoneyParts {
  /** The currency symbol (e.g. `"₹"`, `"$"`), suitable for separate styling. */
  symbol: string
  /** The grouped numeric value without a symbol (e.g. `"1,200"`, `"12.00"`). */
  value: string
}

/**
 * Format an amount into its symbol and numeric value separately, so callers
 * (such as the `Price` atom) can style the symbol independently of the digits.
 *
 * The `value` is produced with `withSymbol: false`, guaranteeing it never
 * contains a currency symbol regardless of how `Intl` would otherwise place it.
 *
 * @param amount   Amount in the currency's major unit.
 * @param currency Currency code. Defaults to {@link DEFAULT_CURRENCY} (`INR`).
 * @param opts     Formatting options (`locale` honoured; `withSymbol` ignored).
 * @returns        `{ symbol, value }` — see {@link MoneyParts}.
 *
 * @example
 *   formatMoneyParts(1200)          // { symbol: "₹", value: "1,200" }
 *   formatMoneyParts(12, 'USD')     // { symbol: "$", value: "12.00" }
 */
export function formatMoneyParts(
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
  opts?: Pick<FormatMoneyOptions, 'locale'>,
): MoneyParts {
  const meta = resolveMeta(currency)
  const value = formatMoney(amount, currency, {
    withSymbol: false,
    locale: opts?.locale,
  })

  return { symbol: meta.symbol, value }
}
