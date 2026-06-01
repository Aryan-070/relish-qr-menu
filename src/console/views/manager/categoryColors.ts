// Brand-aligned palette mapping each menu category to a chart colour.
// Local to the manager surfaces (Reports Center category mix etc.).

export const MANAGER_CATEGORY_COLORS: Record<string, string> = {
  beverages: '#4F7A3C',
  soups: '#D9A03A',
  quickbites: '#C2703D',
  italian: '#8B1024',
  desserts: '#B5567A',
}

/** Fallback colour for any category id not in the brand palette. */
export const DEFAULT_CATEGORY_COLOR = '#8B1024'

export function managerCategoryColor(categoryId: string): string {
  return MANAGER_CATEGORY_COLORS[categoryId] ?? DEFAULT_CATEGORY_COLOR
}
