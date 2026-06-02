import { getItemById, type MenuItem } from './menu'

// ── Combos ──────────────────────────────────────────────────────────────────
// Competitors let guests order curated bundles at a discount. Relish already
// has curated `RecommendationPath`s (mood-based meal collections) but they were
// display-only — the guest had to add each dish by hand. This module promotes
// any such collection into an orderable Combo with a real bundle price computed
// from the live à-la-carte prices, so "Add combo" puts the whole meal in the
// cart in one tap at a saving.

export interface Combo {
  id: string
  name: string
  itemIds: string[]
  itemNames: string[]
  /** Sum of the included items' à-la-carte prices. */
  originalPrice: number
  /** Discounted bundle price actually charged. */
  comboPrice: number
  /** originalPrice − comboPrice (≥ 0). */
  savings: number
}

/** Minimal shape needed to build a combo (a RecommendationPath satisfies it). */
export interface ComboSource {
  id: string
  name: string
  itemIds: string[]
}

/** Bundle discount applied to the à-la-carte total. */
const BUNDLE_DISCOUNT = 0.1

function roundToNearest(value: number, step = 10): number {
  return Math.round(value / step) * step
}

/**
 * Build an orderable Combo from a curated collection, pricing it off the live
 * prices of the resolvable items (unknown ids are skipped). The bundle price is
 * never above the à-la-carte total.
 */
export function buildCombo(source: ComboSource): Combo {
  const items: MenuItem[] = source.itemIds
    .map(getItemById)
    .filter((item): item is MenuItem => Boolean(item))

  const originalPrice = items.reduce((sum, item) => sum + item.price, 0)
  const comboPrice = Math.min(originalPrice, roundToNearest(originalPrice * (1 - BUNDLE_DISCOUNT)))

  return {
    id: source.id,
    name: source.name,
    itemIds: items.map(item => item.id),
    itemNames: items.map(item => item.name),
    originalPrice,
    comboPrice,
    savings: originalPrice - comboPrice,
  }
}

/** Stable order-line id for a combo (kept distinct from per-dish line ids). */
export function comboLineId(comboId: string): string {
  return `combo:${comboId}`
}
