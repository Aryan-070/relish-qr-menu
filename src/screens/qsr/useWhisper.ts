import { useMemo } from 'react'
import {
  categories,
  recommendationPaths,
  getItemById,
  type MenuItem,
  type RecommendationPath,
} from '../../data/menu'
import { buildCombo, type Combo } from '../../data/combos'

// ── The "whisper" engine ─────────────────────────────────────────────────────
// The pitch's one AI job is recommend / combo / upsell — the single point-of-
// order win the research validates ("never fails to suggest"). This module is
// the DETERMINISTIC floor that ships today: it picks at most ONE next-best
// suggestion from the live cart + table context, reusing the existing
// recommendation paths (mood/party scoring), the combo bundle pricing, and each
// dish's curated `pairings`. A server-side Claude call can later replace
// `computeWhisper` while keeping this as the instant, offline-safe fallback.

/** What the waiter taps two chips for on the walk-up to a table. */
export interface TableContext {
  mood: string | null
  partySize: string | null
  /** Hard dietary gate — when true only Jain-safe dishes may be shown/suggested. */
  jainOnly: boolean
}

export interface WhisperItem {
  /** Stable suppression key (so a "No thanks" hides exactly this suggestion). */
  id: string
  kind: 'item'
  text: string
  priceDelta: number
  item: MenuItem
}

export interface WhisperCombo {
  id: string
  kind: 'combo'
  text: string
  priceDelta: number
  combo: Combo
}

export type Whisper = WhisperItem | WhisperCombo

/** Mirror of useRecommendation's weights, as a plain fn for non-hook use. */
function scorePath(path: RecommendationPath, ctx: TableContext): number {
  let score = 0
  if (ctx.mood && path.moodMatch.includes(ctx.mood)) score += 100
  if (ctx.partySize && path.partySizeMatch.includes(ctx.partySize)) score += 70
  return score
}

function isDietarySafe(item: MenuItem, ctx: TableContext): boolean {
  return !ctx.jainOnly || item.isJain
}

/** Loose mood→tag affinity, e.g. mood "Light & Fresh" rewards the `light` tag. */
function moodAffinity(item: MenuItem, ctx: TableContext): number {
  if (!ctx.mood) return 0
  const mood = ctx.mood.toLowerCase()
  return item.tags.some(t => mood.includes(t.toLowerCase())) ? 60 : 0
}

/**
 * The ~12 dishes that matter for THIS table: recommendation-path items first
 * (ranked by how well the path matches the table), then chef's specials and
 * mood-affine dishes, all hard-filtered for dietary safety.
 */
export function buildShortlist(ctx: TableContext, limit = 12): MenuItem[] {
  const allItems = categories.flatMap(c => c.items).filter(item => isDietarySafe(item, ctx))

  // Build a priority order from the best-matching paths.
  const priorityIds: string[] = []
  ;[...recommendationPaths]
    .map(path => ({ path, score: scorePath(path, ctx) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .forEach(({ path }) =>
      path.itemIds.forEach(id => {
        if (!priorityIds.includes(id)) priorityIds.push(id)
      }),
    )

  const scoreItem = (item: MenuItem): number => {
    let score = 0
    const rank = priorityIds.indexOf(item.id)
    if (rank >= 0) score += 1000 - rank * 10
    if (item.chefsSpecial) score += 200
    score += moodAffinity(item, ctx)
    return score
  }

  return [...allItems]
    .map(item => ({ item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item)
}

/** Curated, orderable combos for the table context (used by the guest grid). */
export function combosForContext(ctx: TableContext): Combo[] {
  return [...recommendationPaths]
    .map(path => ({ path, score: scorePath(path, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map(({ path }) => buildCombo(path))
    .filter(combo => combo.itemIds.length > 0)
}

/** Resolve a pairing dish for the last-added item, if any is worth suggesting. */
function pairingSuggestion(
  lastItem: MenuItem,
  inCart: ReadonlySet<string>,
  ctx: TableContext,
  suppressed: ReadonlySet<string>,
): WhisperItem | null {
  const pairingIds = [lastItem.pairings.beverage, lastItem.pairings.side, lastItem.pairings.dessert]
  for (const id of pairingIds) {
    if (!id) continue
    const item = getItemById(id)
    if (!item) continue
    if (inCart.has(item.id) || suppressed.has(item.id)) continue
    if (!isDietarySafe(item, ctx)) continue
    return {
      id: item.id,
      kind: 'item',
      text: `Pair the ${item.name} with that`,
      priceDelta: item.price,
      item,
    }
  }
  return null
}

/** Best combo to *complete* from what's already in the cart, else null. */
function completionSuggestion(
  inCart: ReadonlySet<string>,
  ctx: TableContext,
  suppressed: ReadonlySet<string>,
): WhisperItem | null {
  let best: { item: MenuItem; overlap: number } | null = null
  for (const path of recommendationPaths) {
    const overlap = path.itemIds.filter(id => inCart.has(id)).length
    if (overlap === 0) continue
    for (const id of path.itemIds) {
      if (inCart.has(id) || suppressed.has(id)) continue
      const item = getItemById(id)
      if (!item || !isDietarySafe(item, ctx)) continue
      if (!best || overlap > best.overlap || (overlap === best.overlap && item.price > best.item.price)) {
        best = { item, overlap }
      }
    }
  }
  if (!best) return null
  return {
    id: best.item.id,
    kind: 'item',
    text: `Add ${best.item.name} to round it out`,
    priceDelta: best.item.price,
    item: best.item,
  }
}

/** Last-resort add-on so the strip never goes blank mid-meal (e.g. after a combo). */
function addonSuggestion(
  inCart: ReadonlySet<string>,
  ctx: TableContext,
  suppressed: ReadonlySet<string>,
): WhisperItem | null {
  const isAddon = (item: MenuItem) => item.id.startsWith('bev') || item.id.startsWith('des')
  const candidates = categories
    .flatMap(c => c.items)
    .filter(item => !inCart.has(item.id) && !suppressed.has(item.id) && isDietarySafe(item, ctx))
  const ranked = candidates.sort((a, b) => {
    const score = (item: MenuItem) => (item.chefsSpecial ? 100 : 0) + (isAddon(item) ? 50 : 0)
    return score(b) - score(a)
  })
  const pick = ranked[0]
  if (!pick) return null
  return {
    id: pick.id,
    kind: 'item',
    text: `Add the ${pick.name} on the side`,
    priceDelta: pick.price,
    item: pick,
  }
}

/**
 * Compute the single next-best suggestion. Empty cart → the top combo for the
 * table; otherwise → a pairing for the last dish, a combo-completion, then a
 * popular add-on. Anything in `suppressed` (a logged "No thanks") is skipped.
 */
export function computeWhisper(
  cartItemIds: readonly string[],
  ctx: TableContext,
  suppressed: ReadonlySet<string>,
): Whisper | null {
  const inCart = new Set(cartItemIds)

  if (cartItemIds.length === 0) {
    const combo = combosForContext(ctx)[0]
    if (combo && combo.savings > 0) {
      const key = `combo:${combo.id}`
      if (!suppressed.has(key)) {
        return {
          id: key,
          kind: 'combo',
          text: `Start them with the ${combo.name}`,
          priceDelta: combo.comboPrice,
          combo,
        }
      }
    }
    return null
  }

  const lastId = cartItemIds[cartItemIds.length - 1]
  const lastItem = getItemById(lastId)
  const paired = lastItem ? pairingSuggestion(lastItem, inCart, ctx, suppressed) : null
  if (paired) return paired

  return completionSuggestion(inCart, ctx, suppressed) ?? addonSuggestion(inCart, ctx, suppressed)
}

/** Hook wrapper: memoised whisper for the current cart + context. */
export function useWhisper(
  cartItemIds: readonly string[],
  ctx: TableContext,
  suppressed: ReadonlySet<string>,
): Whisper | null {
  return useMemo(
    () => computeWhisper(cartItemIds, ctx, suppressed),
    [cartItemIds, ctx, suppressed],
  )
}
