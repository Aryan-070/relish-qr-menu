// Pure, dependency-free promo engine for the Relish menu/console.
//
// Money is whole-rupee integers (major units). All discount amounts returned
// by this module are non-negative whole-rupee integers, never exceeding the
// subtotal. These functions are side-effect free and safe to call anywhere
// (consumer cart, console preview, tests).

import type { Promo } from '../console/lib/types'

/** Normalise an arbitrary number into a 0–23 hour-of-day. */
function normalizeHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0
  const h = Math.floor(hour) % 24
  return h < 0 ? h + 24 : h
}

/**
 * Whether a promo is currently usable at the given hour of day.
 *
 * A promo must be `active`. If it defines a happy-hour window (both
 * `startHour` and `endHour` set), the hour must fall inside that window —
 * with wrap-around support (e.g. 22→2 covers 22:00–01:59). A window where
 * start === end is treated as "all day" (always in-window).
 */
export function isPromoActive(promo: Promo, hour: number): boolean {
  if (!promo.active) return false

  const hasWindow = promo.startHour !== undefined && promo.endHour !== undefined
  if (!hasWindow) return true

  const start = normalizeHour(promo.startHour as number)
  const end = normalizeHour(promo.endHour as number)
  const h = normalizeHour(hour)

  if (start === end) return true // full-day window
  if (start < end) return h >= start && h < end // same-day window
  return h >= start || h < end // wrap-around (e.g. 22→2)
}

/**
 * The whole-rupee discount a single promo yields against a subtotal at the
 * given hour. Returns 0 when the promo is inactive/out of window, when the
 * subtotal is non-positive, or for unknown kinds.
 *
 * - `percent`: `value`% off the subtotal (value clamped to 0–100).
 * - `flat`/`coupon`: a flat `value` rupees off.
 *
 * The result is floored to whole rupees and never exceeds the subtotal.
 */
export function applyPromo(subtotal: number, promo: Promo, hour: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0
  if (!isPromoActive(promo, hour)) return 0

  const value = Number.isFinite(promo.value) ? Math.max(0, promo.value) : 0

  let raw: number
  switch (promo.kind) {
    case 'percent':
      raw = (subtotal * Math.min(value, 100)) / 100
      break
    case 'flat':
    case 'coupon':
      raw = value
      break
    default:
      return 0
  }

  const discount = Math.floor(raw)
  if (discount <= 0) return 0
  return Math.min(discount, subtotal)
}

/**
 * The single best (largest-discount) promo for a subtotal at a given hour,
 * along with the rupee discount it yields. Inactive/out-of-window promos are
 * ignored. Returns `null` when no promo applies.
 */
export function bestPromo(
  subtotal: number,
  promos: readonly Promo[],
  hour: number,
): { promo: Promo; discount: number } | null {
  let best: { promo: Promo; discount: number } | null = null
  for (const promo of promos) {
    const discount = applyPromo(subtotal, promo, hour)
    if (discount <= 0) continue
    if (!best || discount > best.discount) best = { promo, discount }
  }
  return best
}
