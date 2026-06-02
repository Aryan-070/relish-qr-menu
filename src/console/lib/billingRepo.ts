// Supabase-backed data layer for the Billing dashboard.
//
// This mirrors the in-memory reducer in src/console/store/useOpsStore.tsx
// (cases BILLING_SET_PACKAGE / BILLING_TOGGLE_AUTORENEW / BILLING_RENEW_NOW)
// and the seed builder in src/data/opsSeed.ts (buildBilling), but reads and
// writes real rows when Supabase is configured.
//
// Domain types + pure helpers are reused from ./billing — nothing is redefined
// here. The only translation this module owns is the epoch-ms <-> ISO timestamp
// mapping between BillingState (numbers) and the DB schema (timestamptz).

import { supabase } from '../../lib/supabase'
import {
  makeInvoice,
  nextInvoiceId,
  packageById,
  type BillingState,
  type Invoice,
  type InvoiceStatus,
  type PackageId,
  type Subscription,
} from './billing'

const YEAR_MS = 365 * 86_400_000
const DEFAULT_GST_PCT = 18

// ── DB row shapes ───────────────────────────────────────────────────────────
// Snake-case rows as returned by supabase-js. We keep these local (not exported)
// so the rest of the app only ever sees the camelCase BillingState types.

interface SubscriptionRow {
  id: string
  restaurant_id: string
  package: PackageId // enum values are exactly the PackageId strings
  started_at: string // ISO timestamptz
  renewal_at: string // ISO timestamptz
  auto_renew: boolean
  gst_pct: number
}

interface InvoiceRow {
  id: string // 'INV-0001'
  restaurant_id: string
  issued_at: string // ISO timestamptz
  description: string
  base: number
  gst: number
  total: number
  status: InvoiceStatus
  razorpay_id: string | null
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

// ── Row <-> domain mapping ──────────────────────────────────────────────────
function rowToSubscription(row: SubscriptionRow): Subscription {
  return {
    packageId: row.package,
    startedAt: isoToMs(row.started_at),
    renewalAt: isoToMs(row.renewal_at),
    autoRenew: row.auto_renew,
    gstPct: row.gst_pct,
  }
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    date: isoToMs(row.issued_at),
    description: row.description,
    base: row.base,
    gst: row.gst,
    total: row.total,
    status: row.status,
  }
}

/** Insert payload for an invoice, derived from a computed domain Invoice. */
function invoiceInsert(restaurantId: string, inv: Invoice) {
  return {
    id: inv.id,
    restaurant_id: restaurantId,
    issued_at: msToIso(inv.date),
    description: inv.description,
    base: inv.base,
    gst: inv.gst,
    total: inv.total,
    status: inv.status,
  }
}

// ── ensureBillingForUser ────────────────────────────────────────────────────
/**
 * Idempotent bootstrap. If the user already has an app_users row, return its
 * restaurant_id unchanged. Otherwise create a restaurant, an admin membership,
 * a starter Cinematic subscription, and the two seed invoices — mirroring
 * buildBilling() in src/data/opsSeed.ts — then return the new restaurant_id.
 */
export async function ensureBillingForUser(userId: string): Promise<string> {
  const db = client()

  // Already bootstrapped? Return the existing restaurant_id, no duplicates.
  const { data: existing, error: lookupErr } = await db
    .from('app_users')
    .select('restaurant_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (lookupErr) throw new Error(lookupErr.message)
  if (existing) return (existing as { restaurant_id: string }).restaurant_id

  // 1. Restaurant.
  const { data: restaurant, error: restErr } = await db
    .from('restaurants')
    .insert({ name: 'My Restaurant' })
    .select('id')
    .single()
  if (restErr) throw new Error(restErr.message)
  const restaurantId = (restaurant as { id: string }).id

  // 2. Membership (admin).
  const { error: memberErr } = await db
    .from('app_users')
    .insert({ user_id: userId, restaurant_id: restaurantId, role: 'admin' })
  if (memberErr) throw new Error(memberErr.message)

  // 3. Starter subscription — Cinematic, started now, renews in a year.
  const pkg = packageById('cinematic')
  const startedAt = Date.now()
  const renewalAt = startedAt + YEAR_MS
  const { error: subErr } = await db.from('subscriptions').insert({
    restaurant_id: restaurantId,
    package: pkg.id,
    started_at: msToIso(startedAt),
    renewal_at: msToIso(renewalAt),
    auto_renew: true,
    gst_pct: DEFAULT_GST_PCT,
  })
  if (subErr) throw new Error(subErr.message)

  // 4. Seed invoices — paid build fee at started_at + due renewal at renewal_at.
  // Mirrors buildBilling(): INV-0001 = paid build, INV-0002 = due renewal.
  const buildInvoice = makeInvoice(
    'INV-0001',
    startedAt,
    `${pkg.name} — one-time build & launch`,
    pkg.oneTime,
    'paid',
  )
  const renewalInvoice = makeInvoice(
    'INV-0002',
    renewalAt,
    `Annual renewal — ${pkg.name}`,
    pkg.renewalYr,
    'due',
  )
  const { error: invErr } = await db
    .from('invoices')
    .insert([
      invoiceInsert(restaurantId, buildInvoice),
      invoiceInsert(restaurantId, renewalInvoice),
    ])
  if (invErr) throw new Error(invErr.message)

  return restaurantId
}

// ── loadBilling ─────────────────────────────────────────────────────────────
/** Read the subscription + invoices (newest first) and map to BillingState. */
export async function loadBilling(restaurantId: string): Promise<BillingState> {
  const db = client()

  const { data: subRow, error: subErr } = await db
    .from('subscriptions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()
  if (subErr) throw new Error(subErr.message)

  const { data: invRows, error: invErr } = await db
    .from('invoices')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('issued_at', { ascending: false })
  if (invErr) throw new Error(invErr.message)

  return {
    subscription: rowToSubscription(subRow as SubscriptionRow),
    invoices: ((invRows ?? []) as InvoiceRow[]).map(rowToInvoice),
  }
}

// ── Internal: fetch current state for a mutation ────────────────────────────
/** Load the raw subscription row + current invoices for an in-place mutation. */
async function loadForMutation(
  restaurantId: string,
): Promise<{ subscription: SubscriptionRow; invoices: Invoice[] }> {
  const db = client()

  const { data: subRow, error: subErr } = await db
    .from('subscriptions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single()
  if (subErr) throw new Error(subErr.message)

  const { data: invRows, error: invErr } = await db
    .from('invoices')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('issued_at', { ascending: false })
  if (invErr) throw new Error(invErr.message)

  return {
    subscription: subRow as SubscriptionRow,
    invoices: ((invRows ?? []) as InvoiceRow[]).map(rowToInvoice),
  }
}

// ── setPackageRemote ────────────────────────────────────────────────────────
/**
 * Mirror BILLING_SET_PACKAGE:
 *  - update subscription.package
 *  - re-rate every open `due` invoice to the new package's annual renewal price
 *  - on an upgrade (newPkg.oneTime > oldPkg.oneTime) insert a paid
 *    "Upgrade … (build fee difference)" invoice for the delta, with a fresh id.
 */
export async function setPackageRemote(
  restaurantId: string,
  packageId: PackageId,
): Promise<void> {
  const db = client()
  const { subscription, invoices } = await loadForMutation(restaurantId)

  // No-op when the package is unchanged (matches the reducer's early return).
  if (packageId === subscription.package) return

  const oldPkg = packageById(subscription.package)
  const newPkg = packageById(packageId)

  // 1. Update the subscription's package.
  const { error: updErr } = await db
    .from('subscriptions')
    .update({ package: newPkg.id })
    .eq('restaurant_id', restaurantId)
  if (updErr) throw new Error(updErr.message)

  // 2. Re-rate any open `due` invoice to the new package's annual price. Keep
  //    each invoice's id + issue date; recompute description/base/gst/total via
  //    makeInvoice so the stored numbers stay consistent.
  const dueInvoices = invoices.filter(i => i.status === 'due')
  for (const due of dueInvoices) {
    const rerated = makeInvoice(
      due.id,
      due.date,
      `Annual renewal — ${newPkg.name}`,
      newPkg.renewalYr,
      'due',
    )
    const { error: rerateErr } = await db
      .from('invoices')
      .update({
        description: rerated.description,
        base: rerated.base,
        gst: rerated.gst,
        total: rerated.total,
      })
      .eq('id', rerated.id)
      .eq('restaurant_id', restaurantId)
    if (rerateErr) throw new Error(rerateErr.message)
  }

  // 3. On an upgrade, bill the one-time build-fee difference now (paid).
  const delta = newPkg.oneTime - oldPkg.oneTime
  if (delta > 0) {
    const upgrade = makeInvoice(
      nextInvoiceId(invoices),
      Date.now(),
      `Upgrade ${oldPkg.name} → ${newPkg.name} (build fee difference)`,
      delta,
      'paid',
    )
    const { error: insErr } = await db
      .from('invoices')
      .insert(invoiceInsert(restaurantId, upgrade))
    if (insErr) throw new Error(insErr.message)
  }
}

// ── renewNowRemote ──────────────────────────────────────────────────────────
/**
 * Mirror BILLING_RENEW_NOW:
 *  - settle every `due` invoice -> `paid` (keep its issued_at)
 *  - advance renewal_at to max(current renewal_at, now) + 1 year
 *  - insert a new `due` annual-renewal invoice dated the new renewal_at.
 */
export async function renewNowRemote(restaurantId: string): Promise<void> {
  const db = client()
  const { subscription, invoices } = await loadForMutation(restaurantId)
  const pkg = packageById(subscription.package)

  // 1. Settle all open invoices -> paid, keeping their issue dates.
  const { error: settleErr } = await db
    .from('invoices')
    .update({ status: 'paid' })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'due')
  if (settleErr) throw new Error(settleErr.message)

  // 2. Advance the renewal date, anchored to today if already overdue.
  const currentRenewalMs = isoToMs(subscription.renewal_at)
  const nextRenewal = Math.max(currentRenewalMs, Date.now()) + YEAR_MS
  const { error: subErr } = await db
    .from('subscriptions')
    .update({ renewal_at: msToIso(nextRenewal) })
    .eq('restaurant_id', restaurantId)
  if (subErr) throw new Error(subErr.message)

  // 3. Raise the next annual renewal, dated the new renewal_at, due.
  //    nextInvoiceId is computed from the pre-settle invoice set, exactly as the
  //    reducer does (it passes b.invoices, not the settled copy).
  const upcoming = makeInvoice(
    nextInvoiceId(invoices),
    nextRenewal,
    `Annual renewal — ${pkg.name}`,
    pkg.renewalYr,
    'due',
  )
  const { error: insErr } = await db
    .from('invoices')
    .insert(invoiceInsert(restaurantId, upcoming))
  if (insErr) throw new Error(insErr.message)
}

// ── toggleAutoRenewRemote ───────────────────────────────────────────────────
/** Mirror BILLING_TOGGLE_AUTORENEW: flip subscription.auto_renew. */
export async function toggleAutoRenewRemote(restaurantId: string): Promise<void> {
  const db = client()

  const { data: subRow, error: readErr } = await db
    .from('subscriptions')
    .select('auto_renew')
    .eq('restaurant_id', restaurantId)
    .single()
  if (readErr) throw new Error(readErr.message)

  const current = (subRow as { auto_renew: boolean }).auto_renew
  const { error: updErr } = await db
    .from('subscriptions')
    .update({ auto_renew: !current })
    .eq('restaurant_id', restaurantId)
  if (updErr) throw new Error(updErr.message)
}
