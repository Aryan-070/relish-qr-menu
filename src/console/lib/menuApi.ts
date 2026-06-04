/**
 * Django-backed menu admin (replaces the dormant Supabase menuRepo for the
 * live console). Maps between the backend MenuItem (paise, snake_case, category
 * UUID, required `code`, optimistic `version`) and a compact admin shape the
 * view uses (rupees, camelCase). All calls carry the staff JWT (apiFetch).
 */
import { apiFetch } from '../../lib/api/client'

export interface AdminCategory {
  id: string
  code: string
  name: string
  sort_order: number
}

export interface AdminMenuItem {
  id: string
  code: string
  name: string
  /** Rupees (backend stores paise). */
  price: number
  description: string
  categoryId: string
  spiceLevel: number
  isJain: boolean
  available: boolean
  soldOut: boolean
  version: number
}

interface ItemRow {
  id: string
  category: string
  code: string
  name: string
  price_minor: number
  description: string
  spice_level: number
  is_jain: boolean
  available: boolean
  sold_out: boolean
  version: number
}

interface Paginated<T> {
  results?: T[]
  count?: number
}

function rowToItem(r: ItemRow): AdminMenuItem {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    price: Math.round(r.price_minor / 100),
    description: r.description ?? '',
    categoryId: r.category,
    spiceLevel: r.spice_level ?? 0,
    isJain: r.is_jain ?? false,
    available: r.available ?? true,
    soldOut: r.sold_out ?? false,
    version: r.version ?? 1,
  }
}

/** Draft fields a create/edit form supplies (no id/version). */
export interface MenuItemDraft {
  name: string
  price: number
  categoryId: string
  description: string
  spiceLevel: number
  isJain: boolean
  available: boolean
  soldOut: boolean
}

function draftToBody(d: MenuItemDraft): Record<string, unknown> {
  return {
    category: d.categoryId,
    name: d.name,
    price_minor: Math.round(d.price * 100),
    description: d.description,
    spice_level: d.spiceLevel,
    is_jain: d.isJain,
    available: d.available,
    sold_out: d.soldOut,
  }
}

/** A stable, URL-safe code derived from the name (uniqueness suffixed). */
function slugCode(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  const suffix = Math.abs(Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)).toString(36).slice(0, 5)
  return `${base || 'item'}-${suffix}`
}

// A high limit so the whole menu loads in one page (admin lists are small).
const ALL = '?limit=500'

export async function listCategories(): Promise<AdminCategory[]> {
  const res = await apiFetch<Paginated<AdminCategory> | AdminCategory[]>(`/menu/categories/${ALL}`)
  return Array.isArray(res) ? res : res.results ?? []
}

export async function listItems(): Promise<AdminMenuItem[]> {
  const res = await apiFetch<Paginated<ItemRow> | ItemRow[]>(`/menu/items/${ALL}`)
  const rows = Array.isArray(res) ? res : res.results ?? []
  return rows.map(rowToItem)
}

export async function createItem(draft: MenuItemDraft): Promise<AdminMenuItem> {
  const row = await apiFetch<ItemRow>('/menu/items/', {
    method: 'POST',
    body: { ...draftToBody(draft), code: slugCode(draft.name) },
  })
  return rowToItem(row)
}

export async function updateItem(
  id: string,
  version: number,
  draft: MenuItemDraft,
): Promise<AdminMenuItem> {
  const row = await apiFetch<ItemRow>(`/menu/items/${id}/`, {
    method: 'PATCH',
    body: { ...draftToBody(draft), version },
  })
  return rowToItem(row)
}

/** Toggle availability / sold-out (PATCH carries the current version). */
export async function patchItem(
  id: string,
  version: number,
  patch: Partial<Pick<ItemRow, 'available' | 'sold_out'>>,
): Promise<AdminMenuItem> {
  const row = await apiFetch<ItemRow>(`/menu/items/${id}/`, {
    method: 'PATCH',
    body: { ...patch, version },
  })
  return rowToItem(row)
}

export async function deleteItem(id: string): Promise<void> {
  await apiFetch<void>(`/menu/items/${id}/`, { method: 'DELETE' })
}
