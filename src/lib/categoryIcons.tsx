import { GlassWater, Soup, Sandwich, Pizza, CakeSlice, Utensils, type LucideIcon } from 'lucide-react'

// Lucide icon family — replaces all category emoji across the app.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  beverages:  GlassWater,
  soups:      Soup,
  quickbites: Sandwich,
  italian:    Pizza,
  desserts:   CakeSlice,
}

export function CategoryIcon({
  categoryId,
  size = 16,
  color,
}: {
  categoryId: string
  size?: number
  color?: string
}) {
  const Icon = CATEGORY_ICON[categoryId] ?? Utensils
  return <Icon size={size} color={color} strokeWidth={1.75} />
}
