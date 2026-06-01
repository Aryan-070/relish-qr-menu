// Small formatting + class-name helpers shared across the console.

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** ₹ with thousands separators, no decimals. */
export function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

/** Compact ₹ for axes / KPI deltas (₹12.4k). */
export function inrCompact(amount: number): string {
  if (Math.abs(amount) >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  if (Math.abs(amount) >= 1_000) return `₹${(amount / 1_000).toFixed(1)}k`
  return `₹${Math.round(amount)}`
}

/** Signed percentage from a fractional delta (0.123 → "+12.3%"). */
export function pct(fraction: number): string {
  const sign = fraction > 0 ? '+' : ''
  return `${sign}${(fraction * 100).toFixed(1)}%`
}

/** "5m ago", "2h ago" from an epoch-ms timestamp. */
export function ago(ts: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - ts) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}
