/**
 * Public guest-menu endpoint binding (`/api/public/menu/<restaurant_id>/`).
 * The QSR surface renders its own rich static menu (cravings/combos/whisper) but
 * resolves each item to a real backend ``MenuItem`` for ordering — keyed by
 * ``code`` (which equals the static qsrMenu item id).
 */
import { apiFetch } from './client'
import type { ThemeConfig } from './themeConfig'

export interface PublicMenuItem {
  id: string
  code: string
  name: string
  price_minor: number
  description?: string
  tags?: string[]
  badges?: string[]
  is_jain?: boolean
  can_be_jain?: boolean
  chefs_special?: boolean
  spice_level?: number
  available: boolean
  sold_out: boolean
  image_url?: string
  video_url?: string
}

export interface PublicMenuCategory {
  id: string
  code: string
  name: string
  sort_order: number
  items: PublicMenuItem[]
}

export interface PublicMenuResponse {
  available: boolean
  restaurant?: { id: string; name: string }
  /** Published theme/branding config for the storefront (landing, colors, logo). */
  theme?: ThemeConfig
  categories?: PublicMenuCategory[]
}

export function getPublicMenu(restaurantId: string): Promise<PublicMenuResponse> {
  return apiFetch<PublicMenuResponse>(`/public/menu/${restaurantId}/`, { staff: false })
}
