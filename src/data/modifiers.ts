import type { MenuItem } from './menu'

// ── Modifier model ──────────────────────────────────────────────────────────
// Competitors (Toast/Square/Petpooja) ship modifier GROUPS with per-option
// upcharges and min/max selection rules. Relish previously had only a flat
// `customizations: string[]` with no pricing. This module introduces priced
// modifier groups while staying backward-compatible: when an item has no
// explicit `modifierGroups`, we DERIVE a single required "preparation" group
// from its `customizations`, inferring small upcharges for clear add-ons. A few
// items get richer multi-select groups via SHOWCASE_GROUPS to exercise the full
// min/max + size-pricing path with real menu data.

export interface ModifierOption {
  id: string
  label: string
  /** Added to the item's base price when this option is selected. */
  priceDelta: number
}

export interface ModifierGroup {
  id: string
  name: string
  /** Minimum options the guest must select (1 = required single/multi). */
  min: number
  /** Maximum options selectable (1 = radio behaviour). */
  max: number
  options: ModifierOption[]
}

export interface SelectedModifier {
  groupId: string
  optionId: string
  label: string
  priceDelta: number
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// Heuristic upcharge for a derived option label (₹). Only clear add-ons cost
// more; modifications ("Less sweet", "No whip") and base preps stay free.
function deriveUpcharge(label: string): number {
  const l = label.toLowerCase()
  if (/gluten-?free/.test(l)) return 40
  if (/3 scoops/.test(l)) return 120
  if (/waffle cone/.test(l)) return 40
  if (/falooda/.test(l)) return 60
  if (/\b(extra|add|loaded|double)\b/.test(l)) return 30
  return 0
}

// Explicit multi-select showcases (keyed by item id) — demonstrate size pricing
// + an optional add-ons group with min/max, the way a real operator would model
// a pizza or a gelato.
const SHOWCASE_GROUPS: Record<string, ModifierGroup[]> = {
  // Margherita Pizza
  'ita-004': [
    {
      id: 'crust',
      name: 'Choose your crust',
      min: 1,
      max: 1,
      options: [
        { id: 'thin', label: 'Thin crust', priceDelta: 0 },
        { id: 'thick', label: 'Thick crust', priceDelta: 0 },
        { id: 'cheese-burst', label: 'Cheese burst', priceDelta: 80 },
        { id: 'gluten-free', label: 'Gluten-free base', priceDelta: 60 },
      ],
    },
    {
      id: 'toppings',
      name: 'Add toppings',
      min: 0,
      max: 4,
      options: [
        { id: 'extra-cheese', label: 'Extra cheese', priceDelta: 50 },
        { id: 'jalapenos', label: 'Jalapeños', priceDelta: 30 },
        { id: 'olives', label: 'Olives', priceDelta: 30 },
        { id: 'mushrooms', label: 'Mushrooms', priceDelta: 40 },
      ],
    },
  ],
  // Gelato (2 scoops)
  'des-003': [
    {
      id: 'serving',
      name: 'Serving',
      min: 1,
      max: 1,
      options: [
        { id: '2-scoops', label: '2 scoops', priceDelta: 0 },
        { id: '3-scoops', label: '3 scoops', priceDelta: 120 },
        { id: 'waffle-cone', label: 'Waffle cone', priceDelta: 40 },
        { id: 'cup', label: 'Cup', priceDelta: 0 },
      ],
    },
    {
      id: 'sauce',
      name: 'Drizzle (optional)',
      min: 0,
      max: 2,
      options: [
        { id: 'chocolate', label: 'Chocolate sauce', priceDelta: 20 },
        { id: 'caramel', label: 'Caramel', priceDelta: 20 },
        { id: 'berry', label: 'Berry coulis', priceDelta: 30 },
      ],
    },
  ],
}

/** Minimal shape needed to resolve groups — both MenuItem and EditableMenuItem
 * satisfy it, so the editor can preview groups without importing the guest model. */
export interface ModifiableItem {
  id: string
  customizations: string[]
  modifierGroups?: ModifierGroup[]
}

/** True when an item carries its own explicitly-authored modifier groups. */
export function hasExplicitModifierGroups(item: Pick<ModifiableItem, 'modifierGroups'>): boolean {
  return Boolean(item.modifierGroups?.length)
}

/** Showcase/derived fallback when an item has no explicit groups of its own. */
function fallbackModifierGroups(item: ModifiableItem): ModifierGroup[] {
  if (SHOWCASE_GROUPS[item.id]) return SHOWCASE_GROUPS[item.id]
  if (!item.customizations.length) return []
  return [
    {
      id: 'prep',
      name: 'Choose preparation',
      min: 1,
      max: 1,
      options: item.customizations.map(c => ({ id: slug(c), label: c, priceDelta: deriveUpcharge(c) })),
    },
  ]
}

/** Resolve an item's modifier groups: explicit override → showcase → derived.
 * An item's own `modifierGroups` (as authored in the console menu editor) always
 * win over the SHOWCASE_GROUPS/derived fallback. */
export function resolveModifierGroups(item: MenuItem): ModifierGroup[] {
  if (hasExplicitModifierGroups(item)) return item.modifierGroups as ModifierGroup[]
  return fallbackModifierGroups(item)
}

/** Initial selection: first option of every required group. */
export function defaultSelection(groups: ModifierGroup[]): SelectedModifier[] {
  return groups.flatMap(g => {
    if (g.min >= 1 && g.options.length > 0) {
      const o = g.options[0]
      return [{ groupId: g.id, optionId: o.id, label: o.label, priceDelta: o.priceDelta }]
    }
    return []
  })
}

export function selectionUnitPrice(base: number, selection: SelectedModifier[]): number {
  return base + selection.reduce((sum, m) => sum + m.priceDelta, 0)
}

/** Human label for a selection, omitting zero-signal base preps like "Regular". */
export function selectionLabel(selection: SelectedModifier[]): string {
  return selection
    .map(m => m.label)
    .filter(l => l.toLowerCase() !== 'regular')
    .join(' · ')
}

/** Stable line key so identical item+selection merges into one order line. */
export function selectionKey(itemId: string, selection: SelectedModifier[]): string {
  const parts = selection.map(m => `${m.groupId}:${m.optionId}`).sort()
  return `${itemId}::${parts.join(',')}`
}

/** True when a selection satisfies every group's min/max rule. */
export function isSelectionValid(groups: ModifierGroup[], selection: SelectedModifier[]): boolean {
  return groups.every(g => {
    const n = selection.filter(s => s.groupId === g.id).length
    return n >= g.min && n <= g.max
  })
}
