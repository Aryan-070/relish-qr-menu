// Brand-aligned palette mapping each menu category to a chart colour.
// Reused by the Category mix donut and any future category-keyed visual.

export const CATEGORY_COLORS: Record<string, string> = {
  beverages: '#4F7A3C',
  soups: '#D9A03A',
  quickbites: '#C2703D',
  italian: '#8B1024',
  desserts: '#B5567A',
}

/** Fallback colour for any category id not in the brand palette. */
export const DEFAULT_CATEGORY_COLOR = '#8B1024'

export function categoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] ?? DEFAULT_CATEGORY_COLOR
}
