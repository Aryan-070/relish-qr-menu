import type { MenuItem } from './menu'

// ── Dietary / allergen model ────────────────────────────────────────────────
// Relish is an "International Veg Cuisine" menu, so every dish is vegetarian by
// default. The meaningful axes for a guest filter are therefore vegan vs.
// dairy, Jain, and the common allergens (gluten, nuts, egg). Rather than
// hand-annotate every item, we DERIVE a profile from the existing name /
// description / tags, while allowing an item to override via optional
// `dietary` / `allergens` fields on MenuItem. This keeps the filter functional
// across the whole catalogue today and precise where an operator edits it.

export type DietaryTag =
  | 'vegetarian'
  | 'vegan'
  | 'jain'
  | 'gluten-free'
  | 'nut-free'
  | 'dairy-free'

export type Allergen = 'dairy' | 'gluten' | 'nuts' | 'egg' | 'soy' | 'sesame'

export interface DietaryProfile {
  /** Positive claims — what the dish IS (drives the guest filter chips). */
  dietary: DietaryTag[]
  /** What the dish CONTAINS — surfaced as an allergen warning line. */
  allergens: Allergen[]
}

export interface NutritionInfo {
  kcal: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface DietaryFilterOption {
  id: DietaryTag
  label: string
}

/** Filter chips offered to the guest, in display order. */
export const DIETARY_FILTERS: readonly DietaryFilterOption[] = [
  { id: 'vegan', label: 'Vegan' },
  { id: 'jain', label: 'Jain' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'nut-free', label: 'Nut-free' },
] as const

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  dairy: 'Dairy',
  gluten: 'Gluten',
  nuts: 'Nuts',
  egg: 'Egg',
  soy: 'Soy',
  sesame: 'Sesame',
}

// Keyword heuristics over name + description + tags. Conservative: when a signal
// is present we flag the allergen (better to over-warn than miss one).
const ALLERGEN_PATTERNS: ReadonlyArray<[Allergen, RegExp]> = [
  ['dairy', /\b(lassi|paneer|cheese|butter|cream|milk|kulfi|gelato|ice ?cream|chai|latte|cappuccino|mocha|yoghurt|yogurt|curd|malai|makhani|alfredo|mozzarella|parmesan|whip|ghee|khoya|khoa|mawa|rabri|rabdi|kheer|basundi|shrikhand|rasmalai|rasgulla|rasagulla|barfi|burfi|peda|halwa|custard|mousse|cheesecake|panna ?cotta|tiramisu|ganache|fudge|kulcha|condensed)\b/i],
  ['nuts', /\b(cashew|almond|walnut|pistachio|peanut|nuts?|badam|kaju|praline|hazelnut|pesto)\b/i],
  ['gluten', /\b(pasta|pizza|bread|bun|roll|naan|roti|paratha|noodle|spaghetti|penne|lasagne|lasagna|sandwich|burger|wrap|brownie|cake|cookie|biscuit|maggi|flour|crouton|crust|pita|focaccia)\b|gulab jamun/i],
  ['egg', /\b(egg|mayonnaise|mayo|meringue)\b/i],
  ['soy', /\b(soy|tofu|edamame|tempeh|teriyaki)\b/i],
  ['sesame', /\b(sesame|tahini|til|hummus)\b/i],
]

function haystack(item: MenuItem): string {
  return `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase()
}

function detectAllergens(item: MenuItem): Allergen[] {
  const hay = haystack(item)
  return ALLERGEN_PATTERNS.filter(([, re]) => re.test(hay)).map(([a]) => a)
}

function deriveDietary(item: MenuItem, allergens: Allergen[]): DietaryTag[] {
  const has = (a: Allergen) => allergens.includes(a)
  const tags: DietaryTag[] = ['vegetarian'] // veg-only menu
  if (!has('dairy')) tags.push('dairy-free')
  if (!has('gluten')) tags.push('gluten-free')
  if (!has('nuts')) tags.push('nut-free')
  // Vegan = no animal-derived allergens (dairy/egg). (No honey signal modelled.)
  if (!has('dairy') && !has('egg')) tags.push('vegan')
  if (item.isJain) tags.push('jain')
  return tags
}

/**
 * Resolve a dish's dietary profile, preferring explicit operator overrides on
 * the item and falling back to keyword derivation.
 */
export function dietaryProfile(item: MenuItem): DietaryProfile {
  const allergens = item.allergens ?? detectAllergens(item)
  const dietary = item.dietary ?? deriveDietary(item, allergens)
  return { dietary, allergens }
}

/** True when the item satisfies every selected dietary filter. */
export function matchesDietary(item: MenuItem, selected: ReadonlySet<DietaryTag>): boolean {
  if (selected.size === 0) return true
  const { dietary } = dietaryProfile(item)
  for (const tag of selected) {
    if (!dietary.includes(tag)) return false
  }
  return true
}
