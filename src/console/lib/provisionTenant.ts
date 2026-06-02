// Idempotent tenant provisioning + seeding for the Relish Staff Console.
//
// `ensureTenant` is called once, right after a staff user signs in. It guarantees
// the signed-in user belongs to exactly one restaurant tenant, creating and
// seeding a fresh one on the very first sign-in and doing nothing on every
// subsequent call.
//
// Idempotency: the first thing we do is look up the caller's row in `app_users`.
// If it exists, the user is already provisioned and we return their existing
// `restaurant_id` without touching anything. Only a brand-new user (no membership
// row) triggers the create + seed path.
//
// Provisioning (restaurant + admin membership) is done by the SECURITY DEFINER
// RPC `bootstrap_tenant()` (see supabase/migrations/0004_bootstrap_rpc.sql). The
// RPC runs server-side and bypasses RLS, sidestepping the chicken-and-egg where a
// client INSERT into `restaurants` can't read its own new row back (the SELECT
// policy keys on current_restaurant_id(), still null before membership exists).
//
// After the RPC returns the restaurant_id, the caller's membership row exists, so
// current_restaurant_id() resolves and the tenant-data seed below passes the
// WITH CHECK (restaurant_id = current_restaurant_id()) policies.
//
// All access goes through the shared `supabase` client. In demo mode that client
// is null, so we short-circuit and return null (the app stays on localStorage).
//
// The only data translation here mirrors the repos in this folder: camelCase
// domain fields → snake_case columns, and epoch-ms timestamps → ISO strings.

import { supabase } from '../../lib/supabase'
import { generateOpsSeed, type OpsSeed } from '../../data/opsSeed'

// ── Time mapping helpers ─────────────────────────────────────────────────────
/** epoch-ms → ISO timestamptz string. */
const msToIso = (ms: number): string => new Date(ms).toISOString()
/** epoch-ms → ISO string, preserving null (for nullable timestamp columns). */
const msToIsoOrNull = (ms: number | null): string | null =>
  ms === null ? null : msToIso(ms)

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Derive a restaurant name from the email local-part, with a safe fallback. */
function nameFromEmail(email?: string | null): string {
  const local = email?.split('@')[0]?.trim()
  return local && local.length > 0 ? local : 'My Restaurant'
}

/**
 * Insert `rows` into `table`, throwing a clear, table-named error on failure so
 * the seed aborts at the first problem. No-ops on an empty array.
 */
async function insertRows(
  db: NonNullable<typeof supabase>,
  table: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await db.from(table).insert(rows)
  if (error) {
    throw new Error(`Seeding "${table}" failed: ${error.message}`)
  }
}

// ── Seed-row builders (domain → snake_case insert payloads) ──────────────────
// Each builder maps one OpsSeed collection into rows ready for a bulk insert,
// stamping every row with the new restaurant_id for RLS-scoped tenant isolation.

function staffRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.staff.map(s => ({
    id: s.id,
    restaurant_id: restaurantId,
    name: s.name,
    role: s.role,
    shift: s.shift,
    hue: s.hue,
  }))
}

function tableRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.tables.map(t => ({
    id: t.id,
    restaurant_id: restaurantId,
    label: t.label,
    seats: t.seats,
    zone: t.zone,
    status: t.status,
    waiter_id: t.waiterId,
    guests: t.guests,
    seated_at: msToIsoOrNull(t.seatedAt),
  }))
}

function menuRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.menu.map(m => ({
    id: m.id,
    restaurant_id: restaurantId,
    category_id: m.categoryId,
    name: m.name,
    price: m.price,
    description: m.description,
    tags: m.tags,
    customizations: m.customizations,
    is_jain: m.isJain,
    can_be_jain: m.canBeJain,
    chefs_special: m.chefsSpecial,
    spice_level: m.spiceLevel,
    available: m.available,
    sold_out: m.soldOut,
    image_url: m.imageUrl ?? null,
    video_url: m.videoUrl ?? null,
    badges: m.badges,
  }))
}

function orderRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.orders.map(o => ({
    id: o.id,
    restaurant_id: restaurantId,
    table_id: o.tableId,
    waiter_id: o.waiterId,
    placed_at: msToIso(o.placedAt),
    total: o.total,
    paid: o.paid,
    status: o.status ?? (o.paid ? 'paid' : 'open'),
  }))
}

// `order_lines` rows are flattened across every order. The DB auto-assigns each
// row's uuid `id`, so we never set it. `modifiers` is optional — included as
// null when absent so the column stays consistent across rows.
function orderLineRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.orders.flatMap(order =>
    order.lines.map(ln => ({
      restaurant_id: restaurantId,
      order_id: order.id,
      item_id: ln.itemId,
      name: ln.name,
      price: ln.price,
      qty: ln.qty,
      category_id: ln.categoryId,
      modifiers: ln.modifiers ?? null,
    })),
  )
}

function requestRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.requests.map(r => ({
    id: r.id,
    restaurant_id: restaurantId,
    table_id: r.tableId,
    type: r.type,
    created_at: msToIso(r.createdAt),
    status: r.status,
    claimed_by: r.claimedBy ?? null,
    note: r.note ?? null,
  }))
}

function customerRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.customers.map(c => ({
    id: c.id,
    restaurant_id: restaurantId,
    name: c.name,
    phone: c.phone,
    points: c.points,
    tier: c.tier,
    visits: c.visits,
    lifetime_spend: c.lifetimeSpend,
    tags: c.tags,
    last_visit: msToIso(c.lastVisit),
    joined_at: msToIso(c.joinedAt),
  }))
}

function reservationRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.reservations.map(r => ({
    id: r.id,
    restaurant_id: restaurantId,
    name: r.name,
    phone: r.phone,
    party_size: r.partySize,
    at: msToIso(r.at),
    table_id: r.tableId,
    status: r.status,
    notes: r.notes ?? null,
    created_at: msToIso(r.createdAt),
  }))
}

function waitlistRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.waitlist.map(w => ({
    id: w.id,
    restaurant_id: restaurantId,
    name: w.name,
    phone: w.phone ?? null,
    party_size: w.partySize,
    quoted_mins: w.quotedMins,
    status: w.status,
    added_at: msToIso(w.addedAt),
  }))
}

function feedbackRows(seed: OpsSeed, restaurantId: string): Array<Record<string, unknown>> {
  return seed.feedback.map(f => ({
    id: f.id,
    restaurant_id: restaurantId,
    rating: f.rating,
    comment: f.comment ?? null,
    table_id: f.tableId ?? null,
    routed_to_public: f.routedToPublic,
    created_at: msToIso(f.createdAt),
  }))
}

/**
 * Bulk-insert a full demo dataset for a freshly created tenant. Tables are
 * inserted independently except for the order/line FK: `order_lines` go in
 * strictly after `orders`. Any insert error aborts the whole seed via a thrown,
 * table-named Error which the caller can surface.
 */
async function seedTenant(
  db: NonNullable<typeof supabase>,
  restaurantId: string,
): Promise<void> {
  const seed = generateOpsSeed()

  await insertRows(db, 'staff', staffRows(seed, restaurantId))
  await insertRows(db, 'restaurant_tables', tableRows(seed, restaurantId))
  await insertRows(db, 'menu_items', menuRows(seed, restaurantId))
  // Orders before their lines (FK dependency).
  await insertRows(db, 'orders', orderRows(seed, restaurantId))
  await insertRows(db, 'order_lines', orderLineRows(seed, restaurantId))
  await insertRows(db, 'service_requests', requestRows(seed, restaurantId))
  await insertRows(db, 'customers', customerRows(seed, restaurantId))
  await insertRows(db, 'reservations', reservationRows(seed, restaurantId))
  await insertRows(db, 'waitlist', waitlistRows(seed, restaurantId))
  await insertRows(db, 'feedback', feedbackRows(seed, restaurantId))
}

// ── Public entry point ───────────────────────────────────────────────────────
/**
 * Ensure the signed-in `user` belongs to a provisioned tenant, returning its
 * `restaurant_id`.
 *
 * - Demo mode (no Supabase client): returns null immediately.
 * - Provisioning: the `bootstrap_tenant` RPC creates the restaurant + admin
 *   membership server-side (idempotent — a no-op once the membership exists).
 * - Seeding: on a brand-new tenant (no menu rows yet) the ops tables are seeded
 *   client-side from `generateOpsSeed()`. Guarded by an emptiness check so a
 *   second caller (e.g. the billing loader) never double-seeds.
 *
 * Throws if any step fails so the caller can surface it.
 */
export async function ensureTenant(
  user: { id: string; email?: string | null },
): Promise<string | null> {
  const db = supabase
  if (!db) return null

  // 1. Provision restaurant + admin membership via the SECURITY DEFINER RPC.
  const { data: rid, error: rpcErr } = await db.rpc('bootstrap_tenant', {
    p_name: nameFromEmail(user.email),
  })
  if (rpcErr) {
    throw new Error(`Tenant provisioning failed: ${rpcErr.message}`)
  }
  const restaurantId = rid as string

  // 2. Seed the ops tables once, only when this tenant has no menu yet.
  const { data: existingMenu, error: menuErr } = await db
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .limit(1)
    .maybeSingle()
  if (menuErr) {
    throw new Error(`Seed check failed: ${menuErr.message}`)
  }
  if (!existingMenu) {
    await seedTenant(db, restaurantId)
  }

  return restaurantId
}
