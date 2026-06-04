import { useMemo } from 'react'
import {
  categories,
  recommendationPaths,
  getItemById,
  matchesDietFilters,
  ENVELOPE_FOR_MOOD,
  type QsrMenuItem,
  type Craving,
  type QsrMood,
  type DietFilter,
} from '../../data/qsrMenu'
import { buildCombo, type Combo } from '../../data/combos'
import type { RecommendationPath } from '../../data/menu'

// ── The Table Theory QSR "whisper" engine ────────────────────────────────────
// A reimagined recommendation concept (vs. the consumer useWhisper): the guest
// states what they're CRAVING (spicy / cheesy / protein / light / comfort /
// sweet) behind a hard dietary gate (veg / vegan / jain), and optionally a table
// MOOD (Solo / Date / Friends / Work). We hard-filter by diet, soft-rank by
// craving + spice + mood, and surface a concept-driven line — plus the brand's
// signature envelope suggestion for the table's mood.

export interface QsrContext {
  /** Hard dietary gate (veg/non-veg/vegan/GF/nut-free/dairy-free); empty = no gate. */
  dietary: ReadonlySet<DietFilter>
  /** Soft taste preferences that re-rank the menu + drive the whisper. */
  cravings: ReadonlySet<Craving>
  /** Table mood → curation weight + matching envelope card. */
  mood: QsrMood | null
}

export interface WhisperItem {
  id: string
  kind: 'item'
  text: string
  priceDelta: number
  item: QsrMenuItem
}
export interface WhisperCombo {
  id: string
  kind: 'combo'
  text: string
  priceDelta: number
  combo: Combo
}
export type Whisper = WhisperItem | WhisperCombo

/** A second, brand-flavoured line: the envelope a server brings for the mood. */
export interface EnvelopeSuggestion {
  name: string
  line: string
}

const CRAVING_LABEL: Record<Craving, string> = {
  spicy: 'Spicy', cheesy: 'Cheesy', protein: 'Protein', light: 'Light', comfort: 'Comfort', sweet: 'Sweet',
}

function isDietarySafe(item: QsrMenuItem, ctx: QsrContext): boolean {
  return matchesDietFilters(item, ctx.dietary)
}

function moodScore(path: RecommendationPath, ctx: QsrContext): number {
  return ctx.mood && path.moodMatch.includes(ctx.mood) ? 100 : 0
}

/** How well a dish satisfies the active cravings (+ spice when Spicy is on). */
function cravingScore(item: QsrMenuItem, ctx: QsrContext): number {
  if (ctx.cravings.size === 0) return 0
  let score = 0
  for (const c of item.cravings) if (ctx.cravings.has(c)) score += 60
  if (ctx.cravings.has('spicy') && item.spiceLevel) score += item.spiceLevel * 15
  return score
}

/**
 * The dishes that matter for THIS table: dietary-safe, ranked by craving
 * overlap, then the best-matching mood path's items, then chef's specials.
 */
export function buildShortlist(ctx: QsrContext, limit = 12): QsrMenuItem[] {
  const safe = categories.flatMap(c => c.items as QsrMenuItem[]).filter(item => isDietarySafe(item, ctx))

  const priorityIds: string[] = []
  ;[...recommendationPaths]
    .map(path => ({ path, score: moodScore(path, ctx) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .forEach(({ path }) => path.itemIds.forEach(id => { if (!priorityIds.includes(id)) priorityIds.push(id) }))

  const scoreItem = (item: QsrMenuItem): number => {
    let score = cravingScore(item, ctx)
    const rank = priorityIds.indexOf(item.id)
    if (rank >= 0) score += 400 - rank * 10
    if (item.chefsSpecial) score += 80
    return score
  }

  return [...safe]
    .map(item => ({ item, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item)
}

/**
 * Score one dish for live menu ordering: craving overlap + a small bonus when
 * it belongs to the active mood's path. Used to re-sort each category grid.
 */
export function menuScore(item: QsrMenuItem, ctx: QsrContext): number {
  let score = cravingScore(item, ctx)
  if (ctx.mood) {
    const inMoodPath = recommendationPaths.some(p => p.moodMatch.includes(ctx.mood as QsrMood) && p.itemIds.includes(item.id))
    if (inMoodPath) score += 50
  }
  if (item.chefsSpecial) score += 5
  return score
}

/** Orderable combos for the context, mood-ranked (used by the guest grid). */
export function combosForContext(ctx: QsrContext): Combo[] {
  return [...recommendationPaths]
    .map(path => ({ path, score: moodScore(path, ctx) }))
    .sort((a, b) => b.score - a.score)
    .map(({ path }) => buildCombo(path))
    .filter(combo => combo.itemIds.length > 0)
}

/** The envelope card to suggest for the table's mood (brand ritual). */
export function envelopeForContext(ctx: QsrContext): EnvelopeSuggestion | null {
  return ctx.mood ? ENVELOPE_FOR_MOOD[ctx.mood] : null
}

function cravingPreamble(ctx: QsrContext): string | null {
  const active = [...ctx.cravings]
  if (active.length === 0) return null
  const names = active.map(c => CRAVING_LABEL[c])
  const phrase = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}`
  return `Because you're craving ${phrase}`
}

function pairingSuggestion(
  lastItem: QsrMenuItem,
  inCart: ReadonlySet<string>,
  ctx: QsrContext,
  suppressed: ReadonlySet<string>,
): WhisperItem | null {
  for (const id of [lastItem.pairings.beverage, lastItem.pairings.side, lastItem.pairings.dessert]) {
    if (!id) continue
    const item = getItemById(id)
    if (!item || inCart.has(item.id) || suppressed.has(item.id) || !isDietarySafe(item, ctx)) continue
    return { id: item.id, kind: 'item', text: `Pair the ${item.name} with that`, priceDelta: item.price, item }
  }
  return null
}

/**
 * One next-best suggestion. Empty cart → top mood combo, or the best craving
 * pick phrased "Because you're craving …". Otherwise → a pairing for the last
 * dish, then a craving/shortlist add-on. Suppressed ("No thanks") ids skipped.
 */
export function computeWhisper(
  cartItemIds: readonly string[],
  ctx: QsrContext,
  suppressed: ReadonlySet<string>,
): Whisper | null {
  const inCart = new Set(cartItemIds)
  const preamble = cravingPreamble(ctx)

  if (cartItemIds.length === 0) {
    // Lead with a craving-driven pick when the guest has stated one.
    if (preamble) {
      const pick = buildShortlist(ctx, 1)[0]
      if (pick && !suppressed.has(pick.id)) {
        return { id: pick.id, kind: 'item', text: `${preamble} → try the ${pick.name}`, priceDelta: pick.price, item: pick }
      }
    }
    const combo = combosForContext(ctx)[0]
    if (combo && combo.savings > 0) {
      const key = `combo:${combo.id}`
      if (!suppressed.has(key)) {
        return { id: key, kind: 'combo', text: `Start them with the ${combo.name}`, priceDelta: combo.comboPrice, combo }
      }
    }
    return null
  }

  const lastItem = getItemById(cartItemIds[cartItemIds.length - 1])
  const paired = lastItem ? pairingSuggestion(lastItem, inCart, ctx, suppressed) : null
  if (paired) return paired

  // Fall back to the best craving/shortlist pick not already in the cart.
  const pick = buildShortlist(ctx, 12).find(i => !inCart.has(i.id) && !suppressed.has(i.id))
  if (!pick) return null
  const text = preamble ? `${preamble} → add the ${pick.name}` : `Add the ${pick.name} to round it out`
  return { id: pick.id, kind: 'item', text, priceDelta: pick.price, item: pick }
}

/** Hook wrapper: memoised whisper for the current cart + context. */
export function useQsrWhisper(
  cartItemIds: readonly string[],
  ctx: QsrContext,
  suppressed: ReadonlySet<string>,
): Whisper | null {
  return useMemo(() => computeWhisper(cartItemIds, ctx, suppressed), [cartItemIds, ctx, suppressed])
}
