// Deterministic mock-data generator for the Staff Console demo.
// A seeded PRNG keeps the dataset stable across reloads, while timestamps are
// anchored to "today" so the analytics windows ("last 7/14/30 days") stay live.

import { categories } from './menu'
import type {
  Customer,
  EditableMenuItem,
  Feedback,
  LoyaltyTier,
  OrderLine,
  OrderRecord,
  Reservation,
  ReservationStatus,
  ServiceRequest,
  Staff,
  Table,
  WaitlistEntry,
  WaitStatus,
  Zone,
} from '../console/lib/types'
import { packageById, makeInvoice, type BillingState, type Invoice } from '../console/lib/billing'

export interface OpsSeed {
  version: number
  generatedAt: number
  staff: Staff[]
  tables: Table[]
  menu: EditableMenuItem[]
  orders: OrderRecord[]
  requests: ServiceRequest[]
  billing: BillingState
  feedback: Feedback[]
  customers: Customer[]
  reservations: Reservation[]
  waitlist: WaitlistEntry[]
}

export const OPS_VERSION = 4
const HISTORY_DAYS = 30
const DAY_MS = 86_400_000

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const randInt = (rng: () => number, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min

/** Weighted pick — `weights` parallels `arr`. */
function weightedPick<T>(rng: () => number, arr: T[], weights: number[]): T {
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = rng() * sum
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i]
    if (r <= 0) return arr[i]
  }
  return arr[arr.length - 1]
}

// ── Static reference lists ──────────────────────────────────────────────────
const WAITER_NAMES = ['Aanya', 'Rohan', 'Meera', 'Dev', 'Kabir', 'Sara']
const ZONES: Zone[] = ['Garden', 'Indoor', 'Patio', 'Bar']

function buildMenu(): EditableMenuItem[] {
  return categories.flatMap(c =>
    c.items.map<EditableMenuItem>(it => ({
      id: it.id,
      name: it.name,
      price: it.price,
      description: it.description,
      categoryId: c.id,
      tags: [...it.tags],
      customizations: [...it.customizations],
      isJain: it.isJain,
      canBeJain: it.canBeJain,
      chefsSpecial: it.chefsSpecial ?? false,
      spiceLevel: it.spiceLevel ?? 0,
      available: true,
      soldOut: false,
      imageUrl: `/assets/dishes/${it.id}.webp`,
      videoUrl: undefined,
      badges: [],
    })),
  )
}

function buildStaff(): Staff[] {
  const staff: Staff[] = [
    { id: 'admin', name: 'Priya Nair', role: 'admin', shift: 'PM', hue: 348 },
    { id: 'mgr', name: 'Vikram Rao', role: 'manager', shift: 'PM', hue: 38 },
  ]
  WAITER_NAMES.forEach((name, i) => {
    staff.push({
      id: `W${i + 1}`,
      name,
      role: 'waiter',
      shift: i % 2 === 0 ? 'AM' : 'PM',
      hue: Math.round((i / WAITER_NAMES.length) * 320) + 10,
    })
  })
  return staff
}

function buildTables(rng: () => number, waiterIds: string[]): Table[] {
  const tables: Table[] = []
  // Live snapshot statuses — a realistic mix for a mid-service floor.
  const liveStatuses: Table['status'][] = [
    'seated', 'ordering', 'available', 'bill-requested', 'seated',
    'available', 'needs-attention', 'ordering', 'available', 'seated',
    'available', 'ordering', 'available', 'bill-requested',
  ]
  for (let i = 0; i < 14; i++) {
    const status = liveStatuses[i]
    const occupied = status !== 'available'
    const seats = pick(rng, [2, 2, 4, 4, 4, 6])
    tables.push({
      id: `T${String(i + 1).padStart(2, '0')}`,
      label: `Table ${i + 1}`,
      seats,
      zone: ZONES[i % ZONES.length],
      status,
      waiterId: occupied ? pick(rng, waiterIds) : (rng() > 0.5 ? pick(rng, waiterIds) : null),
      guests: occupied ? randInt(rng, 1, seats) : 0,
      seatedAt: occupied ? Date.now() - randInt(rng, 8, 95) * 60_000 : null,
    })
  }
  return tables
}

// Hour-of-day weighting — lunch (12–15) and dinner (19–22) peaks.
const HOUR_WEIGHTS: Record<number, number> = {
  11: 3, 12: 9, 13: 12, 14: 8, 15: 4, 16: 2, 17: 3,
  18: 6, 19: 11, 20: 14, 21: 12, 22: 6, 23: 2,
}
const SERVICE_HOURS = Object.keys(HOUR_WEIGHTS).map(Number)
const HOUR_W = SERVICE_HOURS.map(h => HOUR_WEIGHTS[h])

function buildOrders(
  rng: () => number,
  menu: EditableMenuItem[],
  tables: Table[],
  waiterIds: string[],
): OrderRecord[] {
  // Stable per-item popularity so "most ordered" is meaningful and repeatable.
  const popularity = menu.map(() => 0.4 + rng() * 4)
  const orders: OrderRecord[] = []
  let seq = 0
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()

  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const dayStart = todayMs - d * DAY_MS
    const dow = new Date(dayStart).getDay() // 0=Sun
    const weekend = dow === 0 || dow === 5 || dow === 6
    const base = weekend ? 26 : 16
    const count = base + randInt(rng, -4, 5)
    // For "today" only generate orders up to the current hour.
    const nowHour = d === 0 ? new Date().getHours() : 24

    for (let o = 0; o < count; o++) {
      const hour = weightedPick(rng, SERVICE_HOURS, HOUR_W)
      if (hour > nowHour) continue
      const minute = randInt(rng, 0, 59)
      const placedAt = dayStart + hour * 3_600_000 + minute * 60_000
      const lineCount = randInt(rng, 1, 4)
      const lines: OrderLine[] = []
      const usedIdx = new Set<number>()
      for (let l = 0; l < lineCount; l++) {
        const mi = menu.indexOf(weightedPick(rng, menu, popularity))
        if (usedIdx.has(mi)) continue
        usedIdx.add(mi)
        const m = menu[mi]
        lines.push({
          itemId: m.id,
          name: m.name,
          price: m.price,
          qty: randInt(rng, 1, 3),
          categoryId: m.categoryId,
        })
      }
      if (!lines.length) continue
      const total = lines.reduce((s, ln) => s + ln.price * ln.qty, 0)
      seq += 1
      orders.push({
        id: `ORD-${String(seq).padStart(5, '0')}`,
        tableId: pick(rng, tables).id,
        waiterId: pick(rng, waiterIds),
        placedAt,
        lines,
        total,
        paid: true,
      })
    }
  }

  // Open tabs: currently-occupied tables get unpaid orders dated "now" so the
  // Billing screen has live bills to settle.
  for (const t of tables) {
    if (t.status === 'available') continue
    const tabs = randInt(rng, 1, 2)
    for (let k = 0; k < tabs; k++) {
      const lineCount = randInt(rng, 1, 3)
      const lines: OrderLine[] = []
      const used = new Set<number>()
      for (let l = 0; l < lineCount; l++) {
        const mi = menu.indexOf(weightedPick(rng, menu, popularity))
        if (used.has(mi)) continue
        used.add(mi)
        const m = menu[mi]
        lines.push({ itemId: m.id, name: m.name, price: m.price, qty: randInt(rng, 1, 2), categoryId: m.categoryId })
      }
      const total = lines.reduce((s, ln) => s + ln.price * ln.qty, 0)
      seq += 1
      orders.push({
        id: `ORD-${String(seq).padStart(5, '0')}`,
        tableId: t.id,
        waiterId: t.waiterId ?? pick(rng, waiterIds),
        placedAt: (t.seatedAt ?? Date.now()) + randInt(rng, 2, 20) * 60_000,
        lines,
        total,
        paid: false,
      })
    }
  }

  return orders.sort((a, b) => a.placedAt - b.placedAt)
}

const REQUEST_NOTES: Partial<Record<ServiceRequest['type'], string>> = {
  water: 'Still water for the table',
  bill: 'Ready to settle up',
  assistance: 'Question about the menu',
  cleanup: 'Spill near the window seat',
}

function buildRequests(rng: () => number, tables: Table[], waiterIds: string[]): ServiceRequest[] {
  const types: ServiceRequest['type'][] = ['waiter', 'water', 'bill', 'assistance', 'cleanup']
  const active = tables.filter(t => t.status !== 'available')
  const reqs: ServiceRequest[] = []
  const n = Math.min(active.length, randInt(rng, 4, 7))
  for (let i = 0; i < n; i++) {
    const t = active[i]
    const type = pick(rng, types)
    const claimed = rng() > 0.55
    reqs.push({
      id: `REQ-${String(i + 1).padStart(3, '0')}`,
      tableId: t.id,
      type,
      createdAt: Date.now() - randInt(rng, 0, 18) * 60_000,
      status: claimed ? 'claimed' : 'pending',
      claimedBy: claimed ? pick(rng, waiterIds) : null,
      note: REQUEST_NOTES[type],
    })
  }
  return reqs.sort((a, b) => a.createdAt - b.createdAt)
}

// The restaurant's own Relish subscription, shown in the Billing console.
// Seeded on the Cinematic package: a paid build invoice ~300 days ago and an
// upcoming annual renewal (~65 days out) still due.
function buildBilling(): BillingState {
  const pkg = packageById('cinematic')
  const startedAt = Date.now() - 300 * DAY_MS
  const renewalAt = startedAt + 365 * DAY_MS
  const invoices: Invoice[] = [
    makeInvoice('INV-0002', renewalAt, `Annual renewal — ${pkg.name}`, pkg.renewalYr, 'due'),
    makeInvoice('INV-0001', startedAt, `${pkg.name} — one-time build & launch`, pkg.oneTime, 'paid'),
  ]
  return {
    subscription: { packageId: pkg.id, startedAt, renewalAt, autoRenew: true, gstPct: 18 },
    invoices,
  }
}

/** Build a fresh, deterministic dataset anchored to the current date. */
// ── Loyalty / CRM / reservations / feedback seed data ───────────────────────
const CUSTOMER_NAMES = [
  'Aarav Sharma', 'Diya Patel', 'Vivaan Reddy', 'Ananya Iyer', 'Aditya Nair',
  'Ishita Rao', 'Kabir Mehta', 'Saanvi Gupta', 'Reyansh Joshi', 'Myra Kapoor',
  'Arjun Singh', 'Aadhya Verma', 'Vihaan Bose', 'Anika Desai', 'Krishna Menon', 'Pari Malhotra',
]
const CUSTOMER_TAGS = ['Regular', 'Big spender', 'Birthday soon', 'Jain', 'Family', 'New']
const FEEDBACK_COMMENTS = [
  'Loved the paneer tikka!', 'Service was a touch slow today.', 'Beautiful ambience.',
  'Food arrived a bit cold.', 'Best gelato in town — will be back!', 'Lovely evening, thank you.',
  'Could improve the seating spacing.',
]

export function tierForPoints(points: number): LoyaltyTier {
  if (points >= 1500) return 'Gold'
  if (points >= 600) return 'Silver'
  return 'Bronze'
}

function phoneNumber(rng: () => number): string {
  let n = `${randInt(rng, 6, 9)}`
  for (let i = 1; i < 10; i++) n += randInt(rng, 0, 9)
  return `+91 ${n.slice(0, 5)} ${n.slice(5)}`
}

function buildCustomers(rng: () => number, now: number): Customer[] {
  return CUSTOMER_NAMES.map((name, i) => {
    const visits = randInt(rng, 1, 40)
    const lifetimeSpend = visits * randInt(rng, 350, 1200)
    const points = Math.round(lifetimeSpend / 10)
    const tags = [...CUSTOMER_TAGS].sort(() => rng() - 0.5).slice(0, randInt(rng, 0, 2))
    return {
      id: `cus-${String(i + 1).padStart(3, '0')}`,
      name,
      phone: phoneNumber(rng),
      points,
      tier: tierForPoints(points),
      visits,
      lifetimeSpend,
      tags,
      lastVisit: now - randInt(rng, 0, 60) * DAY_MS,
      joinedAt: now - randInt(rng, 60, 720) * DAY_MS,
    }
  })
}

function buildReservations(rng: () => number, now: number, tables: Table[]): Reservation[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const base = start.getTime()
  const slotHalfHours = [24, 26, 27, 38, 39, 40, 41, 42] // ×0.5h → 12:00 … 21:00
  const pastStatuses: ReservationStatus[] = ['completed', 'seated', 'no-show']
  return slotHalfHours.map((slot, i) => {
    const at = base + slot * 1_800_000
    const past = at < now
    const status: ReservationStatus = past ? pick(rng, pastStatuses) : 'booked'
    return {
      id: `res-${String(i + 1).padStart(3, '0')}`,
      name: pick(rng, CUSTOMER_NAMES),
      phone: phoneNumber(rng),
      partySize: randInt(rng, 2, 8),
      at,
      tableId: status === 'seated' ? pick(rng, tables).id : null,
      status,
      notes: rng() < 0.3 ? pick(rng, ['Window seat please', 'Anniversary', 'High chair needed', 'Jain meal']) : undefined,
      createdAt: now - randInt(rng, 1, 5) * DAY_MS,
    }
  })
}

function buildWaitlist(rng: () => number, now: number): WaitlistEntry[] {
  const count = randInt(rng, 2, 4)
  return Array.from({ length: count }, (_, i) => ({
    id: `wait-${String(i + 1).padStart(3, '0')}`,
    name: pick(rng, CUSTOMER_NAMES).split(' ')[0],
    phone: phoneNumber(rng),
    partySize: randInt(rng, 2, 6),
    quotedMins: (i + 1) * 10 + randInt(rng, 0, 5),
    status: (i === 0 ? 'notified' : 'waiting') as WaitStatus,
    addedAt: now - randInt(rng, 1, 30) * 60_000,
  }))
}

function buildFeedback(rng: () => number, now: number, tables: Table[]): Feedback[] {
  const count = randInt(rng, 4, 7)
  return Array.from({ length: count }, (_, i) => {
    const rating = weightedPick(rng, [5, 4, 3, 2, 1], [40, 25, 15, 12, 8])
    return {
      id: `fb-seed-${i + 1}`,
      rating,
      comment: rng() < 0.7 ? pick(rng, FEEDBACK_COMMENTS) : undefined,
      tableId: pick(rng, tables).id,
      createdAt: now - randInt(rng, 0, 14) * DAY_MS - randInt(rng, 0, 86_400) * 1000,
      routedToPublic: rating >= 4,
    }
  }).sort((a, b) => b.createdAt - a.createdAt)
}

export function generateOpsSeed(seed = 0x5e11a9): OpsSeed {
  const rng = mulberry32(seed)
  const now = Date.now()
  const staff = buildStaff()
  const waiterIds = staff.filter(s => s.role === 'waiter').map(s => s.id)
  const menu = buildMenu()
  const tables = buildTables(rng, waiterIds)
  const orders = buildOrders(rng, menu, tables, waiterIds)
  const requests = buildRequests(rng, tables, waiterIds)
  const billing = buildBilling()
  return {
    version: OPS_VERSION,
    generatedAt: now,
    staff,
    tables,
    menu,
    orders,
    requests,
    billing,
    feedback: buildFeedback(rng, now, tables),
    customers: buildCustomers(rng, now),
    reservations: buildReservations(rng, now, tables),
    waitlist: buildWaitlist(rng, now),
  }
}
