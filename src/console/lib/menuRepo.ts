// Supabase-backed data layer for the Menu editor (Phase 0 ops spine).
//
// Mirrors the in-memory reducer in src/console/store/useOpsStore.tsx
// (MENU_CREATE / MENU_UPDATE / MENU_DELETE / MENU_TOGGLE_AVAILABLE /
// MENU_TOGGLE_SOLDOUT) and the seed builder in src/data/opsSeed.ts (buildMenu),
// but reads and writes real rows when Supabase is configured.
//
// The only translation this module owns is the snake_case DB row <-> camelCase
// EditableMenuItem mapping; the domain type itself is reused from ./types.

import { supabase } from '../../lib/supabase'
import type { EditableMenuItem } from './types'

// ── DB row shape ─────────────────────────────────────────────────────────────
// Snake-case as returned by supabase-js. dietary/allergens/nutrition/
// modifier_groups exist in 0002_ops.sql as forward-compat columns; they are not
// (yet) part of EditableMenuItem, so this module reads but does not surface them.
interface MenuItemRow {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  price: number
  description: string | null
  tags: string[] | null
  customizations: string[] | null
  is_jain: boolean
  can_be_jain: boolean
  chefs_special: boolean
  spice_level: number
  available: boolean
  sold_out: boolean
  image_url: string | null
  video_url: string | null
  badges: string[] | null
}

// ── Guard ────────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// The columns we read — kept in one place so every select stays consistent.
const COLUMNS =
  'id,restaurant_id,category_id,name,price,description,tags,customizations,' +
  'is_jain,can_be_jain,chefs_special,spice_level,available,sold_out,' +
  'image_url,video_url,badges'

// ── Row <-> domain mapping ──────────────────────────────────────────────────
/** Clamp an arbitrary number into the 0..3 spice-level union. */
function toSpiceLevel(n: number): EditableMenuItem['spiceLevel'] {
  if (n <= 0) return 0
  if (n >= 3) return 3
  return n === 1 ? 1 : 2
}

function rowToItem(row: MenuItemRow): EditableMenuItem {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    description: row.description ?? '',
    categoryId: row.category_id,
    tags: row.tags ?? [],
    customizations: row.customizations ?? [],
    isJain: row.is_jain,
    canBeJain: row.can_be_jain,
    chefsSpecial: row.chefs_special,
    spiceLevel: toSpiceLevel(row.spice_level),
    available: row.available,
    soldOut: row.sold_out,
    imageUrl: row.image_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    badges: row.badges ?? [],
  }
}

/** The mutable column set shared by insert and update (no id / restaurant_id). */
function itemColumns(item: EditableMenuItem) {
  return {
    category_id: item.categoryId,
    name: item.name,
    price: item.price,
    description: item.description,
    tags: item.tags,
    customizations: item.customizations,
    is_jain: item.isJain,
    can_be_jain: item.canBeJain,
    chefs_special: item.chefsSpecial,
    spice_level: item.spiceLevel,
    available: item.available,
    sold_out: item.soldOut,
    image_url: item.imageUrl ?? null,
    video_url: item.videoUrl ?? null,
    badges: item.badges,
  }
}

/** Full insert payload: the mutable columns plus the keys. */
function itemInsert(restaurantId: string, item: EditableMenuItem) {
  return { id: item.id, restaurant_id: restaurantId, ...itemColumns(item) }
}

// ── listMenu ─────────────────────────────────────────────────────────────────
/** Read every menu item for a restaurant, mapped to EditableMenuItem. */
export async function listMenu(restaurantId: string): Promise<EditableMenuItem[]> {
  const db = client()
  const { data, error } = await db
    .from('menu_items')
    .select(COLUMNS)
    .eq('restaurant_id', restaurantId)
    .order('category_id', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  // Cast via unknown: COLUMNS is a runtime string, so supabase-js can't infer
  // the row shape — we own the shape via MenuItemRow.
  return ((data ?? []) as unknown as MenuItemRow[]).map(rowToItem)
}

// ── createMenuItem ───────────────────────────────────────────────────────────
/** Mirror MENU_CREATE: insert a new item and return the stored row mapped back. */
export async function createMenuItem(
  restaurantId: string,
  item: EditableMenuItem,
): Promise<EditableMenuItem> {
  const db = client()
  const { data, error } = await db
    .from('menu_items')
    .insert(itemInsert(restaurantId, item))
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return rowToItem(data as unknown as MenuItemRow)
}

// ── updateMenuItem ───────────────────────────────────────────────────────────
/** Mirror MENU_UPDATE: overwrite the item's editable fields by id. */
export async function updateMenuItem(
  restaurantId: string,
  item: EditableMenuItem,
): Promise<EditableMenuItem> {
  const db = client()
  // id + restaurant_id are the key — never part of the update payload.
  const { data, error } = await db
    .from('menu_items')
    .update(itemColumns(item))
    .eq('restaurant_id', restaurantId)
    .eq('id', item.id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return rowToItem(data as unknown as MenuItemRow)
}

// ── deleteMenuItem ───────────────────────────────────────────────────────────
/** Mirror MENU_DELETE: remove the item by id. */
export async function deleteMenuItem(restaurantId: string, id: string): Promise<void> {
  const db = client()
  const { error } = await db
    .from('menu_items')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── setAvailable ─────────────────────────────────────────────────────────────
/** Mirror MENU_TOGGLE_AVAILABLE (explicit value): set the available flag. */
export async function setAvailable(
  restaurantId: string,
  id: string,
  available: boolean,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('menu_items')
    .update({ available })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── setSoldOut ───────────────────────────────────────────────────────────────
/** Mirror MENU_TOGGLE_SOLDOUT (explicit value): set the sold_out flag. */
export async function setSoldOut(
  restaurantId: string,
  id: string,
  soldOut: boolean,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('menu_items')
    .update({ sold_out: soldOut })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}
