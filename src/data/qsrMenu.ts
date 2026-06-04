// ── The Table Theory — QSR menu (own dataset, NOT the Relish consumer menu) ──
// The /qsr surface pitches a different brand: a quick-service café with bowls,
// wraps, sandwiches, pasta, sides, beverages and desserts — and, unlike the
// all-vegetarian Relish catalogue, this one has non-veg dishes. We mirror the
// `src/data/menu.ts` contract (MenuItem / Category / RecommendationPath +
// helpers) so the existing QSR components and combo/dietary utilities work
// unchanged, then extend each item with two QSR-only axes that drive the new
// recommendation concept: `isVeg` (veg / non-veg dot + gate) and `cravings`.

import type { MenuItem, Category, RecommendationPath } from './menu'
import { detectAllergens, type DietaryTag } from './dietary'
import type { ModifierGroup } from './modifiers'

/** Soft "what are you in the mood to eat" axis — drives the Craving rail. */
export type Craving = 'spicy' | 'cheesy' | 'protein' | 'light' | 'comfort' | 'sweet'

/** A table's mood — drives curation + the matching envelope suggestion. */
export type QsrMood = 'Solo' | 'Date' | 'Friends' | 'Work'

/** Hard dietary gate — veg/non-veg split plus allergen-derived claims. */
export type DietFilter = 'veg' | 'nonveg' | 'vegan' | 'gluten-free' | 'nut-free' | 'dairy-free'

export const DIET_FILTERS: ReadonlyArray<{ id: DietFilter; label: string }> = [
  { id: 'veg', label: 'Veg' },
  { id: 'nonveg', label: 'Non-veg' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'GF' },
  { id: 'nut-free', label: 'Nut-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
] as const

export interface QsrMenuItem extends MenuItem {
  /** Veg vs non-veg — the dietary dot + the Veg/Non-veg gate. */
  isVeg: boolean
  /** Soft preference tags for craving-based ranking. */
  cravings: Craving[]
  /** Resolved hard-gate claims (veg/nonveg + allergen-free derivations). */
  diet: DietFilter[]
}

// ── Display metadata for the preference UI ──────────────────────────────────
export const CRAVINGS: ReadonlyArray<{ id: Craving; label: string; emoji: string }> = [
  { id: 'spicy', label: 'Spicy', emoji: '🔥' },
  { id: 'cheesy', label: 'Cheesy', emoji: '🧀' },
  { id: 'protein', label: 'Protein', emoji: '💪' },
  { id: 'light', label: 'Light', emoji: '🥗' },
  { id: 'comfort', label: 'Comfort', emoji: '🍲' },
  { id: 'sweet', label: 'Sweet', emoji: '🍫' },
] as const

export const MOODS: ReadonlyArray<{ id: QsrMood; label: string; sub: string }> = [
  { id: 'Solo', label: 'Solo', sub: 'A table for one' },
  { id: 'Date', label: 'Date', sub: 'For two' },
  { id: 'Friends', label: 'Friends', sub: 'The group table' },
  { id: 'Work', label: 'Work', sub: 'The lunch break' },
] as const

/** The envelope card a server brings for each table mood (brand ritual). */
export const ENVELOPE_FOR_MOOD: Record<QsrMood, { name: string; line: string }> = {
  Solo: { name: 'The Quiet Table', line: 'For the guest sitting alone — a thought to keep you company.' },
  Date: { name: 'The Chemistry', line: 'For couples — subtle, curious, never cheesy.' },
  Friends: { name: 'The Debate', line: 'For friend groups — a hot take worth arguing over.' },
  Work: { name: 'The Office Confession', line: 'For the workday lunch — a little honesty with the meal.' },
}

// ── Item builder ────────────────────────────────────────────────────────────
// Derives the dietary[] profile from veg/vegan/jain flags so the existing
// `matchesDietary` gate works (non-veg items deliberately get NO 'vegetarian').
interface Mk {
  id: string
  name: string
  price: number
  desc: string
  veg: boolean
  vegan?: boolean
  jain?: boolean
  spice?: 0 | 1 | 2 | 3
  cravings?: Craving[]
  chef?: boolean
  tags?: string[]
  pairings?: { beverage?: string; side?: string; dessert?: string }
  customizations?: string[]
  modifierGroups?: ModifierGroup[]
}

function mk(p: Mk): QsrMenuItem {
  const dietary: DietaryTag[] = []
  if (p.veg) dietary.push('vegetarian')
  if (p.vegan) dietary.push('vegan', 'dairy-free')
  if (p.jain) dietary.push('jain')

  // Resolve the hard-gate claims: veg/non-veg from the flag, vegan explicit, and
  // gluten-/nut-/dairy-free from the ABSENCE of keyword-detected allergens.
  const tags = p.tags ?? []
  const allergens = detectAllergens({ name: p.name, description: p.desc, tags } as MenuItem)
  const diet: DietFilter[] = [p.veg ? 'veg' : 'nonveg']
  if (p.vegan) diet.push('vegan')
  if (!allergens.includes('gluten')) diet.push('gluten-free')
  if (!allergens.includes('nuts')) diet.push('nut-free')
  if (!allergens.includes('dairy')) diet.push('dairy-free')

  return {
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.desc,
    isVeg: p.veg,
    isJain: Boolean(p.jain),
    canBeJain: false,
    cravings: p.cravings ?? [],
    diet,
    spiceLevel: p.spice,
    chefsSpecial: p.chef,
    dietary,
    tags,
    pairings: p.pairings ?? {},
    customizations: p.customizations ?? [],
    modifierGroups: p.modifierGroups,
  }
}

/** True when the item satisfies every selected hard dietary filter. */
export function matchesDietFilters(item: QsrMenuItem, selected: ReadonlySet<DietFilter>): boolean {
  for (const f of selected) if (!item.diet.includes(f)) return false
  return true
}

// ── Build-Your-Own modifier groups (the 4-step builder, as priced modifiers) ─
const BYO_GROUPS: ModifierGroup[] = [
  {
    id: 'byo-base', name: 'Choose your base', min: 1, max: 1,
    options: [
      { id: 'b-rice', label: 'Steamed Rice', priceDelta: 0 },
      { id: 'b-herbed', label: 'Herbed Rice', priceDelta: 0 },
      { id: 'b-noodles', label: 'Noodles', priceDelta: 20 },
      { id: 'b-lettuce', label: 'Lettuce Mix', priceDelta: 20 },
    ],
  },
  {
    id: 'byo-protein', name: 'Choose your protein', min: 1, max: 1,
    options: [
      { id: 'p-periPaneer', label: 'Peri Peri Paneer', priceDelta: 59 },
      { id: 'p-tandooriPaneer', label: 'Tandoori Paneer', priceDelta: 69 },
      { id: 'p-mushroom', label: 'Crispy Mushroom', priceDelta: 69 },
      { id: 'p-soya', label: 'Schezwan Soya', priceDelta: 49 },
      { id: 'p-smokyChicken', label: 'Smoky Chicken', priceDelta: 89 },
      { id: 'p-koreanChicken', label: 'Korean Chicken', priceDelta: 99 },
      { id: 'p-butterChicken', label: 'Butter Chicken', priceDelta: 109 },
    ],
  },
  {
    id: 'byo-sauce', name: 'Choose your sauce', min: 1, max: 1,
    options: [
      { id: 's-peri', label: 'Smoky Peri Sauce', priceDelta: 0 },
      { id: 's-korean', label: 'Korean Spicy Mayo', priceDelta: 0 },
      { id: 's-herb', label: 'Creamy Herb Sauce', priceDelta: 0 },
      { id: 's-garlic', label: 'Garlic Butter Sauce', priceDelta: 0 },
      { id: 's-chipotle', label: 'Tandoori Chipotle', priceDelta: 0 },
    ],
  },
  {
    id: 'byo-toppings', name: 'Add toppings', min: 0, max: 5,
    options: [
      { id: 't-onions', label: 'Crispy Onions', priceDelta: 20 },
      { id: 't-cheese', label: 'Cheese Sauce', priceDelta: 25 },
      { id: 't-jalapeno', label: 'Jalapeños', priceDelta: 20 },
      { id: 't-garlic', label: 'Fried Garlic', priceDelta: 20 },
      { id: 't-egg', label: 'Fried Egg', priceDelta: 30 },
    ],
  },
]

// ── Categories ──────────────────────────────────────────────────────────────
export const categories: Category[] = [
  {
    id: 'bowls',
    name: 'Signature Bowls',
    description: 'Build your own or pick a curated signature.',
    editorialNote: 'Every bowl: your choice of base, protein, sauce & toppings.',
    backgroundAnimation: 'swirl',
    items: [
      mk({ id: 'ttb-byo', name: 'Build Your Own Bowl', price: 169, desc: 'Customise in 4 steps — base, protein, sauce & toppings.', veg: true, chef: true, cravings: ['comfort'], tags: ['customise'], modifierGroups: BYO_GROUPS, pairings: { beverage: 'ttbev-coldcoffee', side: 'ttsd-fries' } }),
      mk({ id: 'ttb-butterpaneer', name: 'Butter Paneer Bowl', price: 229, desc: 'Herbed rice · Rich butter sauce · Paneer.', veg: true, cravings: ['comfort', 'cheesy'], tags: ['indian', 'creamy'], pairings: { beverage: 'ttbev-masalachai', dessert: 'ttdes-brownie' } }),
      mk({ id: 'ttb-tandooripaneer', name: 'Tandoori Paneer Bowl', price: 239, desc: 'Steamed rice · Tandoori chipotle · Paneer.', veg: true, spice: 1, cravings: ['comfort'], tags: ['indian', 'smoky'] }),
      mk({ id: 'ttb-smokychicken', name: 'Smoky Chicken Bowl', price: 269, desc: 'Herbed rice · Smoky peri sauce · Chicken.', veg: false, spice: 1, cravings: ['protein', 'comfort'], tags: ['smoky'], pairings: { side: 'ttsd-fries', beverage: 'ttbev-coldcoffee' } }),
      mk({ id: 'ttb-butterchicken', name: 'Butter Chicken Bowl', price: 289, desc: 'Steamed rice · Rich butter sauce · Chicken.', veg: false, cravings: ['protein', 'comfort', 'cheesy'], tags: ['bestseller', 'indian'], pairings: { beverage: 'ttbev-masalachai', dessert: 'ttdes-browniecream' } }),
      mk({ id: 'ttb-koreanveg', name: 'Korean Veg Bowl', price: 249, desc: 'Noodles · Korean spicy mayo · Veg.', veg: true, spice: 2, cravings: ['spicy'], tags: ['asian'] }),
      mk({ id: 'ttb-koreanchicken', name: 'Korean Chicken Bowl', price: 299, desc: 'Noodles · Korean spicy mayo · Chicken.', veg: false, spice: 2, cravings: ['spicy', 'protein'], tags: ['popular', 'asian'], pairings: { side: 'ttsd-koreanfries', beverage: 'ttbev-watermelon' } }),
      mk({ id: 'ttb-teriyaki', name: 'Teriyaki Chicken Bowl', price: 309, desc: 'Herbed rice · Garlic butter sauce · Chicken.', veg: false, cravings: ['protein'], tags: ['asian'] }),
      mk({ id: 'ttb-schezwanpaneer', name: 'Schezwan Paneer Bowl', price: 249, desc: 'Noodles · Schezwan toss · Paneer.', veg: true, spice: 2, cravings: ['spicy', 'cheesy'], tags: ['asian'] }),
      mk({ id: 'ttb-grilledprotein', name: 'Grilled Chicken Protein Bowl', price: 319, desc: 'Lettuce mix · Creamy herb sauce · Grilled chicken.', veg: false, cravings: ['protein', 'light'], tags: ['high-protein', 'healthy'], pairings: { beverage: 'ttbev-peachtea' } }),
      mk({ id: 'ttb-vegpower', name: 'Veg Power Bowl', price: 249, desc: 'Lettuce mix · Corn & bean · Herb sauce.', veg: true, vegan: true, cravings: ['light', 'protein'], tags: ['healthy'], pairings: { beverage: 'ttbev-mojito' } }),
      mk({ id: 'ttb-paneercorn', name: 'Paneer & Corn Fresh Bowl', price: 259, desc: 'Lettuce mix · Creamy herb · Fresh toppings.', veg: true, cravings: ['light', 'cheesy'], tags: ['healthy'] }),
    ],
  },
  {
    id: 'wraps',
    name: 'Signature Wraps',
    description: 'Handcrafted wraps with your pick of protein & sauce.',
    editorialNote: 'Rolled hot, packed full.',
    backgroundAnimation: 'none',
    items: [
      mk({ id: 'ttw-tandooripaneer', name: 'Tandoori Paneer Wrap', price: 169, desc: 'Marinated paneer · Mint · Onions.', veg: true, spice: 1, cravings: ['comfort'], tags: ['veg'] }),
      mk({ id: 'ttw-periveggie', name: 'Peri Peri Veggie Wrap', price: 159, desc: 'Peri peri veggies · Fresh slaw.', veg: true, vegan: true, spice: 2, cravings: ['spicy', 'light'], tags: ['veg'] }),
      mk({ id: 'ttw-schezwancorn', name: 'Schezwan Corn & Cheese Wrap', price: 179, desc: 'Sweet corn · Schezwan · Cheese.', veg: true, spice: 1, cravings: ['cheesy', 'spicy'], tags: ['veg'] }),
      mk({ id: 'ttw-mushroom', name: 'Crispy Mushroom Wrap', price: 189, desc: 'Crispy mushroom · Herb mayo.', veg: true, cravings: ['comfort'], tags: ['veg'] }),
      mk({ id: 'ttw-smokychicken', name: 'Smoky Chicken Wrap', price: 209, desc: 'Smoky chicken · Chipotle · Slaw.', veg: false, spice: 1, cravings: ['protein', 'comfort'], tags: ['nonveg'] }),
      mk({ id: 'ttw-koreanchicken', name: 'Korean Chicken Wrap', price: 219, desc: 'Korean chicken · Spicy mayo.', veg: false, spice: 2, cravings: ['spicy', 'protein'], tags: ['popular', 'nonveg'] }),
      mk({ id: 'ttw-butterchicken', name: 'Butter Chicken Wrap', price: 229, desc: 'Butter chicken · Onions · Mint.', veg: false, cravings: ['protein', 'cheesy', 'comfort'], tags: ['bestseller', 'nonveg'] }),
      mk({ id: 'ttw-crispychicken', name: 'Crispy Chicken Wrap', price: 209, desc: 'Crispy fried chicken · Sriracha mayo.', veg: false, spice: 1, cravings: ['protein'], tags: ['nonveg'] }),
    ],
  },
  {
    id: 'sandwiches',
    name: 'Grilled Sandwiches',
    description: 'Hot-pressed, golden-grilled, generously filled.',
    editorialNote: 'The café classic.',
    backgroundAnimation: 'none',
    items: [
      mk({ id: 'ttsw-threecheese', name: 'Three Cheese Sandwich', price: 169, desc: 'Triple cheese blend · Grilled.', veg: true, cravings: ['cheesy', 'comfort'], tags: ['veg'] }),
      mk({ id: 'ttsw-pestocorn', name: 'Pesto Corn Sandwich', price: 179, desc: 'Basil pesto · Sweet corn · Mozzarella.', veg: true, cravings: ['cheesy'], tags: ['veg'] }),
      mk({ id: 'ttsw-paneertikka', name: 'Paneer Tikka Sandwich', price: 199, desc: 'Marinated paneer · Mint chutney · Onions.', veg: true, spice: 1, cravings: ['comfort'], tags: ['veg'] }),
      mk({ id: 'ttsw-chickenmelt', name: 'Chicken & Cheese Melt', price: 229, desc: 'Pulled chicken · Cheddar melt · Chipotle.', veg: false, cravings: ['cheesy', 'protein', 'comfort'], tags: ['bestseller', 'nonveg'] }),
      mk({ id: 'ttsw-spicychicken', name: 'Spicy Chicken Sandwich', price: 239, desc: 'Crispy chicken · Sriracha mayo · Slaw.', veg: false, spice: 2, cravings: ['spicy', 'protein'], tags: ['nonveg'] }),
    ],
  },
  {
    id: 'pasta',
    name: 'Fresh Pasta',
    description: 'Made-to-order in rich white and red sauces.',
    editorialNote: 'White or red, your call.',
    backgroundAnimation: 'steam',
    items: [
      mk({ id: 'ttp-vegalfredo', name: 'Creamy Veg Alfredo Pasta', price: 219, desc: 'Rich béchamel · Vegetables · Parmesan.', veg: true, cravings: ['cheesy', 'comfort'], tags: ['white', 'veg'] }),
      mk({ id: 'ttp-chickenalfredo', name: 'Chicken Alfredo Pasta', price: 269, desc: 'Grilled chicken · Creamy alfredo · Herbs.', veg: false, cravings: ['cheesy', 'protein', 'comfort'], tags: ['bestseller', 'white', 'nonveg'] }),
      mk({ id: 'ttp-vegarrabbiata', name: 'Arrabbiata Veg Pasta', price: 209, desc: 'Spicy tomato · Garden vegetables · Basil.', veg: true, vegan: true, spice: 2, cravings: ['spicy', 'light'], tags: ['red', 'veg'] }),
      mk({ id: 'ttp-chickenarrabbiata', name: 'Spicy Chicken Arrabbiata', price: 269, desc: 'Chicken · Fiery arrabbiata · Fresh herbs.', veg: false, spice: 3, cravings: ['spicy', 'protein'], tags: ['red', 'nonveg'] }),
    ],
  },
  {
    id: 'sides',
    name: 'Sides & Snacks',
    description: 'Perfect companions. Or a snack on their own.',
    editorialNote: 'Crispy bites.',
    backgroundAnimation: 'none',
    items: [
      mk({ id: 'ttsd-fries', name: 'Classic Fries', price: 99, desc: 'Golden, salted, crispy.', veg: true, vegan: true, cravings: ['comfort'], tags: ['veg'] }),
      mk({ id: 'ttsd-perifries', name: 'Peri Peri Fries', price: 119, desc: 'House peri peri seasoning.', veg: true, vegan: true, spice: 2, cravings: ['spicy'], tags: ['veg'] }),
      mk({ id: 'ttsd-cheesefries', name: 'Loaded Cheese Fries', price: 179, desc: 'Fries · Cheese sauce · Jalapeños.', veg: true, spice: 1, cravings: ['cheesy', 'comfort'], tags: ['veg'] }),
      mk({ id: 'ttsd-koreanfries', name: 'Korean Loaded Fries', price: 199, desc: 'Fries · Korean mayo · Crispy toppings.', veg: true, spice: 2, cravings: ['spicy', 'cheesy'], tags: ['new', 'veg'] }),
      mk({ id: 'ttsd-chickenpops', name: 'Crispy Chicken Pops', price: 189, desc: 'Bite-sized crispy chicken · Dip.', veg: false, cravings: ['protein', 'comfort'], tags: ['bestseller', 'nonveg'] }),
      mk({ id: 'ttsd-garlicbread', name: 'Garlic Breadsticks', price: 119, desc: 'Herb butter · Garlic · Dip included.', veg: true, cravings: ['comfort'], tags: ['veg'] }),
      mk({ id: 'ttsd-nachos', name: 'Nachos & Cheese Dip', price: 169, desc: 'Tortilla chips · Cheese dip · Salsa.', veg: true, cravings: ['cheesy'], tags: ['veg'] }),
    ],
  },
  {
    id: 'beverages',
    name: 'Drinks & Beverages',
    description: 'Hot coffee, cold brews, coolers, shakes & chai.',
    editorialNote: 'All day, all mood.',
    backgroundAnimation: 'bubbles',
    items: [
      mk({ id: 'ttbev-cappuccino', name: 'Cappuccino', price: 139, desc: 'Espresso · Steamed milk · Foam.', veg: true, cravings: ['comfort'], tags: ['hot'] }),
      mk({ id: 'ttbev-coldcoffee', name: 'Classic Cold Coffee', price: 159, desc: 'Chilled, frothy, house blend.', veg: true, cravings: ['sweet'], tags: ['cold'] }),
      mk({ id: 'ttbev-caramelfrappe', name: 'Caramel Frappe', price: 199, desc: 'Caramel · Coffee · Cream.', veg: true, cravings: ['sweet'], tags: ['cold'] }),
      mk({ id: 'ttbev-oreocoldcoffee', name: 'Oreo Cold Coffee', price: 219, desc: 'Oreo crumble · Cream.', veg: true, cravings: ['sweet'], tags: ['cold'] }),
      mk({ id: 'ttbev-mojito', name: 'Mint Mojito', price: 139, desc: 'Mint · Lime · Soda.', veg: true, vegan: true, cravings: ['light'], tags: ['cooler'] }),
      mk({ id: 'ttbev-peachtea', name: 'Peach Iced Tea', price: 149, desc: 'Brewed tea · Peach · Ice.', veg: true, vegan: true, cravings: ['light'], tags: ['cooler'] }),
      mk({ id: 'ttbev-watermelon', name: 'Watermelon Cooler', price: 159, desc: 'Fresh watermelon · Mint · Lime.', veg: true, vegan: true, cravings: ['light'], tags: ['cooler'] }),
      mk({ id: 'ttbev-chocshake', name: 'Belgian Chocolate Shake', price: 199, desc: 'Belgian chocolate · Ice cream.', veg: true, cravings: ['sweet'], tags: ['shake'] }),
      mk({ id: 'ttbev-brownieshake', name: 'Brownie Shake', price: 219, desc: 'Brownie chunks · Ice cream · Cream.', veg: true, cravings: ['sweet'], tags: ['bestseller', 'shake'] }),
      mk({ id: 'ttbev-masalachai', name: 'Masala Chai', price: 59, desc: 'Spiced milk tea.', veg: true, cravings: ['comfort'], tags: ['chai'] }),
      mk({ id: 'ttbev-kulhadchai', name: 'Kulhad Chai', price: 79, desc: 'Clay-cup chai, slow-brewed.', veg: true, cravings: ['comfort'], tags: ['bestseller', 'chai'] }),
      mk({ id: 'ttbev-smokedcoffee', name: 'Smoked Cold Coffee', price: 239, desc: 'Cold coffee, wood-smoke finish.', veg: true, chef: true, cravings: ['sweet'], tags: ['signature'] }),
      mk({ id: 'ttbev-nitro', name: 'Nitro Coffee Cooler', price: 249, desc: 'Nitro-charged, velvety pour.', veg: true, chef: true, cravings: ['light'], tags: ['signature'] }),
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    description: 'Sweet endings & indulgences.',
    editorialNote: 'Save room.',
    backgroundAnimation: 'none',
    items: [
      mk({ id: 'ttdes-brownie', name: 'Chocolate Brownie', price: 99, desc: 'Warm, fudgy, house-baked.', veg: true, cravings: ['sweet', 'comfort'], tags: ['sweet'] }),
      mk({ id: 'ttdes-browniecream', name: 'Brownie with Ice Cream', price: 159, desc: 'Warm brownie · Vanilla scoop · Drizzle.', veg: true, cravings: ['sweet', 'comfort'], tags: ['bestseller', 'sweet'] }),
      mk({ id: 'ttdes-chocjar', name: 'Chocolate Dessert Jar', price: 179, desc: 'Layered mousse · Crumble · Cream.', veg: true, cravings: ['sweet'], tags: ['sweet'] }),
      mk({ id: 'ttdes-biscoffjar', name: 'Lotus Biscoff Jar', price: 199, desc: 'Biscoff cream · Cookie crumble · Caramel.', veg: true, cravings: ['sweet'], tags: ['must-try', 'sweet'] }),
    ],
  },
]

// ── Recommendation paths (mood-keyed) ───────────────────────────────────────
// moodMatch values are the QsrMood labels so the whisper engine can score them.
export const recommendationPaths: RecommendationPath[] = [
  {
    id: 'solo-quick',
    name: 'The Quick One',
    tagline: 'In and out, light and good',
    itemIds: ['ttb-vegpower', 'ttsd-fries', 'ttbev-coldcoffee'],
    estimatedPrice: 507,
    reason: 'A fresh power bowl, classic fries and a cold coffee — a fast, balanced solo lunch.',
    moodMatch: ['Solo'],
    partySizeMatch: ['Just me'],
    budgetMatch: ['₹300–₹500'],
  },
  {
    id: 'date-share',
    name: 'The Shareable',
    tagline: 'Two bowls, one sweet finish',
    itemIds: ['ttb-butterchicken', 'ttb-schezwanpaneer', 'ttsd-koreanfries', 'ttdes-browniecream'],
    estimatedPrice: 896,
    reason: 'A pair of signature bowls to trade bites, loaded fries to share, and a brownie for two.',
    moodMatch: ['Date'],
    partySizeMatch: ['Two people'],
    budgetMatch: ['₹500+'],
  },
  {
    id: 'friends-feast',
    name: 'The Group Table',
    tagline: 'Wraps, fries and shakes for the crew',
    itemIds: ['ttw-koreanchicken', 'ttw-periveggie', 'ttsd-cheesefries', 'ttbev-brownieshake'],
    estimatedPrice: 716,
    reason: 'A spread of wraps, loaded cheese fries and a brownie shake — built for the group table.',
    moodMatch: ['Friends'],
    partySizeMatch: ['Group'],
    budgetMatch: ['₹500+'],
  },
  {
    id: 'work-lunch',
    name: 'The Office Lunch',
    tagline: 'A proper bowl + a cooler',
    itemIds: ['ttb-grilledprotein', 'ttbev-peachtea'],
    estimatedPrice: 468,
    reason: 'A high-protein grilled bowl and a peach iced tea — the workday refuel.',
    moodMatch: ['Work'],
    partySizeMatch: ['Just me'],
    budgetMatch: ['₹300–₹500'],
  },
]

// ── Helpers (mirror src/data/menu.ts) ───────────────────────────────────────
const allItems: QsrMenuItem[] = categories.flatMap(c => c.items as QsrMenuItem[])

export function getItemById(id: string): QsrMenuItem | undefined {
  return allItems.find(item => item.id === id)
}

export function getCategoryById(id: string): Category | undefined {
  return categories.find(c => c.id === id)
}

export function getCategoryForItem(itemId: string): string {
  const prefix = itemId.split('-')[0]
  switch (prefix) {
    case 'ttb': return 'bowls'
    case 'ttw': return 'wraps'
    case 'ttsw': return 'sandwiches'
    case 'ttp': return 'pasta'
    case 'ttsd': return 'sides'
    case 'ttbev': return 'beverages'
    case 'ttdes': return 'desserts'
    default: return 'bowls'
  }
}

/** Narrowing helper — every item in this dataset is a QsrMenuItem. */
export function asQsr(item: MenuItem): QsrMenuItem {
  return item as QsrMenuItem
}
