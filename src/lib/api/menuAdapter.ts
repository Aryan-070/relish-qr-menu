/**
 * Adapt the backend public menu (`/api/public/menu/<id>/`) into the consumer
 * app's static `Category[]` shape so the existing UI renders backend-driven
 * data unchanged. This is what makes console price edits show up for guests.
 *
 * Price convention: the backend stores `price_minor` in **paise**; the consumer
 * `MenuItem.price` is in whole rupees — divide by 100 (matches
 * `console/lib/menuApi.ts`).
 */
import type { Category, MenuItem } from '../../data/menu'
import type { PublicMenuItem, PublicMenuResponse } from './publicMenu'

function adaptItem(item: PublicMenuItem): MenuItem {
  return {
    id: item.id,
    name: item.name,
    price: Math.round(item.price_minor / 100),
    description: '',
    isJain: false,
    canBeJain: false,
    tags: item.sold_out || !item.available ? ['sold-out'] : [],
    pairings: {},
    customizations: [],
  }
}

export function adaptPublicMenu(res: PublicMenuResponse): Category[] {
  const categories = res.categories ?? []
  return categories
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cat) => ({
      id: cat.code || cat.id,
      name: cat.name,
      description: '',
      editorialNote: '',
      backgroundAnimation: 'none' as const,
      // Only list available items the guest can actually order.
      items: cat.items.filter((i) => i.available).map(adaptItem),
    }))
    .filter((cat) => cat.items.length > 0)
}
