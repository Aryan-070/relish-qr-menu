import type { EditableMenuItem } from '../lib/types'

/** Factory for a blank custom menu item (used by the MenuManager create form). */
export function newMenuItem(categoryId = 'beverages'): EditableMenuItem {
  return {
    id: `cust-${Date.now().toString(36)}`,
    name: '',
    price: 0,
    description: '',
    categoryId,
    tags: [],
    customizations: [],
    isJain: false,
    canBeJain: false,
    chefsSpecial: false,
    spiceLevel: 0,
    available: true,
    soldOut: false,
    imageUrl: undefined,
    videoUrl: undefined,
    badges: [],
  }
}
