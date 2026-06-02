// Supabase-backed data layer for the Inventory / procurement + promotions +
// governance-audit domains (Phase 1/2).
//
// This mirrors the in-memory reducer in src/console/store/useOpsStore.tsx and
// the seed builders in src/data/opsSeed.ts, but reads and writes real rows when
// Supabase is configured. Today these domains are DEMO-ONLY (localStorage via
// the ops store) — this repo exists so the future wiring drops in the same way
// billingRepo.ts wires the Billing dashboard.
//
// Domain types are reused from ./types — nothing is redefined here. The only
// translation this module owns is the epoch-ms <-> ISO timestamp mapping
// between the camelCase domain types (numbers) and the DB schema (timestamptz),
// plus snake_case <-> camelCase column naming.
//
// Mirrors the shape of billingRepo.ts:
//  - every public fn calls client() first, which throws if !isSupabaseConfigured
//  - rows are mapped to/from the domain types via row<->domain helpers
//  - all errors are surfaced as thrown Error(message)

import { supabase } from '../../lib/supabase'
import type {
  AuditEntry,
  AuditType,
  Ingredient,
  Promo,
  PromoKind,
  PurchaseOrder,
  PoStatus,
  Recipe,
  RecipeLine,
  StockMovement,
  Supplier,
  WastageEntry,
} from './types'

// ── DB row shapes ───────────────────────────────────────────────────────────
// Snake-case rows as returned by supabase-js. We keep these local (not exported)
// so the rest of the app only ever sees the camelCase domain types.

interface IngredientRow {
  id: string
  restaurant_id: string
  name: string
  unit: string
  stock: number
  low_threshold: number
  cost_per_unit: number
  supplier_id: string | null
}

interface RecipeRow {
  item_id: string
  restaurant_id: string
  lines: RecipeLine[] // jsonb
}

interface SupplierRow {
  id: string
  restaurant_id: string
  name: string
  phone: string | null
  email: string | null
}

interface PurchaseOrderRow {
  id: string
  restaurant_id: string
  supplier_id: string
  lines: { ingredientId: string; qty: number; cost: number }[] // jsonb
  status: PoStatus
  created_at: string // ISO timestamptz
  received_at: string | null // ISO timestamptz
}

interface WastageRow {
  id: string
  restaurant_id: string
  ingredient_id: string
  qty: number
  reason: string
  created_at: string // ISO timestamptz
}

interface StockMovementRow {
  id: string
  restaurant_id: string
  ingredient_id: string
  delta: number
  reason: StockMovement['reason']
  ref_id: string | null
  created_at: string // ISO timestamptz
}

interface PromoRow {
  id: string
  restaurant_id: string
  name: string
  kind: PromoKind
  value: number
  code: string | null
  single_use: boolean
  active: boolean
  start_hour: number | null
  end_hour: number | null
  created_at: string // ISO timestamptz
}

interface AuditRow {
  id: string
  restaurant_id: string
  type: AuditType
  order_id: string | null
  table_id: string | null
  amount: number | null
  reason: string
  staff_id: string | null
  created_at: string // ISO timestamptz
}

// ── Time mapping helpers ────────────────────────────────────────────────────
const isoToMs = (iso: string): number => Date.parse(iso)
const msToIso = (ms: number): string => new Date(ms).toISOString()

// ── Guard ───────────────────────────────────────────────────────────────────
/** Narrow `supabase` to non-null, or fail loudly. Every public fn calls this. */
function client(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Supabase not configured')
  return supabase
}

// ── Row -> domain mapping ───────────────────────────────────────────────────
function rowToIngredient(row: IngredientRow): Ingredient {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    stock: row.stock,
    lowThreshold: row.low_threshold,
    costPerUnit: row.cost_per_unit,
    supplierId: row.supplier_id ?? undefined,
  }
}

function rowToRecipe(row: RecipeRow): Recipe {
  return { itemId: row.item_id, lines: row.lines ?? [] }
}

function rowToSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
  }
}

function rowToPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    lines: row.lines ?? [],
    status: row.status,
    createdAt: isoToMs(row.created_at),
    receivedAt: row.received_at ? isoToMs(row.received_at) : undefined,
  }
}

function rowToWastage(row: WastageRow): WastageEntry {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    qty: row.qty,
    reason: row.reason,
    createdAt: isoToMs(row.created_at),
  }
}

function rowToStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    ingredientId: row.ingredient_id,
    delta: row.delta,
    reason: row.reason,
    refId: row.ref_id ?? undefined,
    createdAt: isoToMs(row.created_at),
  }
}

function rowToPromo(row: PromoRow): Promo {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    value: row.value,
    code: row.code ?? undefined,
    singleUse: row.single_use,
    active: row.active,
    startHour: row.start_hour ?? undefined,
    endHour: row.end_hour ?? undefined,
    createdAt: isoToMs(row.created_at),
  }
}

function rowToAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    type: row.type,
    orderId: row.order_id ?? undefined,
    tableId: row.table_id ?? undefined,
    amount: row.amount ?? undefined,
    reason: row.reason,
    staffId: row.staff_id ?? undefined,
    createdAt: isoToMs(row.created_at),
  }
}

// ── Domain -> insert payload helpers ────────────────────────────────────────
function ingredientInsert(restaurantId: string, i: Ingredient) {
  return {
    id: i.id,
    restaurant_id: restaurantId,
    name: i.name,
    unit: i.unit,
    stock: i.stock,
    low_threshold: i.lowThreshold,
    cost_per_unit: i.costPerUnit,
    supplier_id: i.supplierId ?? null,
  }
}

function supplierInsert(restaurantId: string, s: Supplier) {
  return {
    id: s.id,
    restaurant_id: restaurantId,
    name: s.name,
    phone: s.phone ?? null,
    email: s.email ?? null,
  }
}

function purchaseOrderInsert(restaurantId: string, po: PurchaseOrder) {
  return {
    id: po.id,
    restaurant_id: restaurantId,
    supplier_id: po.supplierId,
    lines: po.lines,
    status: po.status,
    created_at: msToIso(po.createdAt),
    received_at: po.receivedAt ? msToIso(po.receivedAt) : null,
  }
}

function wastageInsert(restaurantId: string, w: WastageEntry) {
  return {
    id: w.id,
    restaurant_id: restaurantId,
    ingredient_id: w.ingredientId,
    qty: w.qty,
    reason: w.reason,
    created_at: msToIso(w.createdAt),
  }
}

function stockMovementInsert(restaurantId: string, m: StockMovement) {
  return {
    id: m.id,
    restaurant_id: restaurantId,
    ingredient_id: m.ingredientId,
    delta: m.delta,
    reason: m.reason,
    ref_id: m.refId ?? null,
    created_at: msToIso(m.createdAt),
  }
}

function promoInsert(restaurantId: string, p: Promo) {
  return {
    id: p.id,
    restaurant_id: restaurantId,
    name: p.name,
    kind: p.kind,
    value: p.value,
    code: p.code ?? null,
    single_use: p.singleUse ?? false,
    active: p.active,
    start_hour: p.startHour ?? null,
    end_hour: p.endHour ?? null,
    created_at: msToIso(p.createdAt),
  }
}

function auditInsert(restaurantId: string, e: AuditEntry) {
  return {
    id: e.id,
    restaurant_id: restaurantId,
    type: e.type,
    order_id: e.orderId ?? null,
    table_id: e.tableId ?? null,
    amount: e.amount ?? null,
    reason: e.reason,
    staff_id: e.staffId ?? null,
    created_at: msToIso(e.createdAt),
  }
}

// ── Ingredients ─────────────────────────────────────────────────────────────
export async function listIngredients(restaurantId: string): Promise<Ingredient[]> {
  const db = client()
  const { data, error } = await db
    .from('ingredients')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as IngredientRow[]).map(rowToIngredient)
}

export async function upsertIngredient(
  restaurantId: string,
  ingredient: Ingredient,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('ingredients')
    .upsert(ingredientInsert(restaurantId, ingredient), { onConflict: 'restaurant_id,id' })
  if (error) throw new Error(error.message)
}

export async function updateIngredient(
  restaurantId: string,
  id: string,
  patch: Partial<Ingredient>,
): Promise<void> {
  const db = client()
  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) update.name = patch.name
  if (patch.unit !== undefined) update.unit = patch.unit
  if (patch.stock !== undefined) update.stock = patch.stock
  if (patch.lowThreshold !== undefined) update.low_threshold = patch.lowThreshold
  if (patch.costPerUnit !== undefined) update.cost_per_unit = patch.costPerUnit
  if (patch.supplierId !== undefined) update.supplier_id = patch.supplierId ?? null
  const { error } = await db
    .from('ingredients')
    .update(update)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Recipes ─────────────────────────────────────────────────────────────────
export async function listRecipes(restaurantId: string): Promise<Recipe[]> {
  const db = client()
  const { data, error } = await db
    .from('recipes')
    .select('*')
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as RecipeRow[]).map(rowToRecipe)
}

export async function setRecipe(
  restaurantId: string,
  itemId: string,
  lines: RecipeLine[],
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('recipes')
    .upsert(
      { item_id: itemId, restaurant_id: restaurantId, lines },
      { onConflict: 'restaurant_id,item_id' },
    )
  if (error) throw new Error(error.message)
}

// ── Suppliers ───────────────────────────────────────────────────────────────
export async function listSuppliers(restaurantId: string): Promise<Supplier[]> {
  const db = client()
  const { data, error } = await db
    .from('suppliers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as SupplierRow[]).map(rowToSupplier)
}

export async function insertSupplier(
  restaurantId: string,
  supplier: Supplier,
): Promise<void> {
  const db = client()
  const { error } = await db.from('suppliers').insert(supplierInsert(restaurantId, supplier))
  if (error) throw new Error(error.message)
}

// ── Purchase orders ─────────────────────────────────────────────────────────
export async function listPurchaseOrders(restaurantId: string): Promise<PurchaseOrder[]> {
  const db = client()
  const { data, error } = await db
    .from('purchase_orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as PurchaseOrderRow[]).map(rowToPurchaseOrder)
}

export async function insertPurchaseOrder(
  restaurantId: string,
  po: PurchaseOrder,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('purchase_orders')
    .insert(purchaseOrderInsert(restaurantId, po))
  if (error) throw new Error(error.message)
}

export async function setPurchaseOrderStatus(
  restaurantId: string,
  id: string,
  status: PoStatus,
  receivedAt?: number,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('purchase_orders')
    .update({ status, received_at: receivedAt ? msToIso(receivedAt) : null })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Wastage ─────────────────────────────────────────────────────────────────
export async function listWastage(restaurantId: string): Promise<WastageEntry[]> {
  const db = client()
  const { data, error } = await db
    .from('wastage')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as WastageRow[]).map(rowToWastage)
}

export async function insertWastage(
  restaurantId: string,
  entry: WastageEntry,
): Promise<void> {
  const db = client()
  const { error } = await db.from('wastage').insert(wastageInsert(restaurantId, entry))
  if (error) throw new Error(error.message)
}

// ── Stock movements ─────────────────────────────────────────────────────────
export async function listStockMovements(restaurantId: string): Promise<StockMovement[]> {
  const db = client()
  const { data, error } = await db
    .from('stock_movements')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as StockMovementRow[]).map(rowToStockMovement)
}

export async function insertStockMovement(
  restaurantId: string,
  movement: StockMovement,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('stock_movements')
    .insert(stockMovementInsert(restaurantId, movement))
  if (error) throw new Error(error.message)
}

// ── Promotions ──────────────────────────────────────────────────────────────
export async function listPromos(restaurantId: string): Promise<Promo[]> {
  const db = client()
  const { data, error } = await db
    .from('promos')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as PromoRow[]).map(rowToPromo)
}

export async function insertPromo(restaurantId: string, promo: Promo): Promise<void> {
  const db = client()
  const { error } = await db.from('promos').insert(promoInsert(restaurantId, promo))
  if (error) throw new Error(error.message)
}

export async function setPromoActive(
  restaurantId: string,
  id: string,
  active: boolean,
): Promise<void> {
  const db = client()
  const { error } = await db
    .from('promos')
    .update({ active })
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePromo(restaurantId: string, id: string): Promise<void> {
  const db = client()
  const { error } = await db
    .from('promos')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Audit log ───────────────────────────────────────────────────────────────
export async function listAudit(restaurantId: string): Promise<AuditEntry[]> {
  const db = client()
  const { data, error } = await db
    .from('audit_log')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as AuditRow[]).map(rowToAudit)
}

export async function insertAudit(restaurantId: string, entry: AuditEntry): Promise<void> {
  const db = client()
  const { error } = await db.from('audit_log').insert(auditInsert(restaurantId, entry))
  if (error) throw new Error(error.message)
}
