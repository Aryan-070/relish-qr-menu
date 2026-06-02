// Deterministic mock-data generator for the Staff Console demo.
// A seeded PRNG keeps the dataset stable across reloads, while timestamps are
// anchored to "today" so the analytics windows ("last 7/14/30 days") stay live.

import { categories } from './menu'
import type {
  Attendance,
  AuditEntry,
  Customer,
  EditableMenuItem,
  Feedback,
  Ingredient,
  LoyaltyTier,
  OrderLine,
  OrderRecord,
  Outlet,
  Permission,
  Promo,
  PurchaseOrder,
  Recipe,
  Reservation,
  ReservationStatus,
  ServiceRequest,
  Shift,
  Staff,
  StockMovement,
  Supplier,
  Table,
  WaitlistEntry,
  WaitStatus,
  WastageEntry,
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
  auditLog: AuditEntry[]
  ingredients: Ingredient[]
  recipes: Recipe[]
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  wastage: WastageEntry[]
  stockMovements: StockMovement[]
  promos: Promo[]
  shifts: Shift[]
  attendance: Attendance[]
  outlets: Outlet[]
}

export const OPS_VERSION = 6
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

// Default RBAC grants per role. Admin gets everything; managers get most
// operational powers but cannot manage staff; waiters get a minimal floor set.
const ALL_PERMISSIONS: Permission[] = [
  'void', 'comp', 'discount', 'refund', 'edit-menu', 'manage-stock', 'manage-staff', 'view-reports',
]
const MANAGER_PERMISSIONS: Permission[] = [
  'void', 'comp', 'discount', 'refund', 'edit-menu', 'manage-stock', 'view-reports',
]
const WAITER_PERMISSIONS: Permission[] = ['void']

function permissionsForRole(role: Staff['role']): Permission[] {
  if (role === 'admin') return [...ALL_PERMISSIONS]
  if (role === 'manager') return [...MANAGER_PERMISSIONS]
  return [...WAITER_PERMISSIONS]
}

const emailForName = (name: string): string =>
  `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@relish.in`

function buildStaff(): Staff[] {
  const staff: Staff[] = [
    {
      id: 'admin', name: 'Priya Nair', role: 'admin', shift: 'PM', hue: 348,
      permissions: permissionsForRole('admin'), active: true, email: emailForName('Priya Nair'),
    },
    {
      id: 'mgr', name: 'Vikram Rao', role: 'manager', shift: 'PM', hue: 38,
      permissions: permissionsForRole('manager'), active: true, email: emailForName('Vikram Rao'),
    },
  ]
  WAITER_NAMES.forEach((name, i) => {
    staff.push({
      id: `W${i + 1}`,
      name,
      role: 'waiter',
      shift: i % 2 === 0 ? 'AM' : 'PM',
      hue: Math.round((i / WAITER_NAMES.length) * 320) + 10,
      permissions: permissionsForRole('waiter'),
      active: true,
      email: emailForName(name),
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

// ── Inventory / procurement / promotions / audit seed data ──────────────────
// Ingredient ids are stable string keys referenced by recipes, purchase orders,
// wastage and stock movements. Stock/threshold/cost are whole numbers; cost is
// in whole rupees per `unit` (major units, matching the rest of the app).
interface IngredientSpec {
  id: string
  name: string
  unit: string
  stock: number
  lowThreshold: number
  costPerUnit: number
  supplierId: string
}

// A couple are seeded deliberately close to (or at) their low threshold so the
// low-stock UI always has something to surface — paneer & coffee beans below,
// basil exactly at threshold.
const INGREDIENT_SPECS: IngredientSpec[] = [
  { id: 'ing-paneer', name: 'Paneer', unit: 'kg', stock: 3, lowThreshold: 4, costPerUnit: 320, supplierId: 'sup-001' },
  { id: 'ing-tomato', name: 'Tomato', unit: 'kg', stock: 42, lowThreshold: 10, costPerUnit: 40, supplierId: 'sup-001' },
  { id: 'ing-flour', name: 'Refined Flour', unit: 'kg', stock: 60, lowThreshold: 15, costPerUnit: 45, supplierId: 'sup-002' },
  { id: 'ing-cheese', name: 'Mozzarella Cheese', unit: 'kg', stock: 9, lowThreshold: 5, costPerUnit: 520, supplierId: 'sup-001' },
  { id: 'ing-coffee', name: 'Coffee Beans', unit: 'kg', stock: 2, lowThreshold: 3, costPerUnit: 900, supplierId: 'sup-003' },
  { id: 'ing-milk', name: 'Milk', unit: 'ltr', stock: 55, lowThreshold: 20, costPerUnit: 60, supplierId: 'sup-001' },
  { id: 'ing-basil', name: 'Fresh Basil', unit: 'kg', stock: 2, lowThreshold: 2, costPerUnit: 280, supplierId: 'sup-001' },
  { id: 'ing-pasta', name: 'Pasta', unit: 'kg', stock: 34, lowThreshold: 10, costPerUnit: 130, supplierId: 'sup-002' },
  { id: 'ing-sugar', name: 'Sugar', unit: 'kg', stock: 48, lowThreshold: 12, costPerUnit: 50, supplierId: 'sup-002' },
  { id: 'ing-mushroom', name: 'Mushroom', unit: 'kg', stock: 11, lowThreshold: 6, costPerUnit: 240, supplierId: 'sup-001' },
  { id: 'ing-corn', name: 'Sweet Corn', unit: 'kg', stock: 18, lowThreshold: 5, costPerUnit: 90, supplierId: 'sup-001' },
  { id: 'ing-mango', name: 'Mango Pulp', unit: 'ltr', stock: 14, lowThreshold: 6, costPerUnit: 180, supplierId: 'sup-003' },
]

function buildSuppliers(): Supplier[] {
  return [
    { id: 'sup-001', name: 'FreshFarm Produce Co.', phone: '+91 98200 11223', email: 'orders@freshfarm.in' },
    { id: 'sup-002', name: 'Grainhouse Distributors', phone: '+91 98200 44556', email: 'sales@grainhouse.in' },
    { id: 'sup-003', name: 'Roast & Pulp Traders', phone: '+91 98200 77889', email: 'hello@roastpulp.in' },
  ]
}

function buildIngredients(): Ingredient[] {
  return INGREDIENT_SPECS.map(s => ({
    id: s.id,
    name: s.name,
    unit: s.unit,
    stock: s.stock,
    lowThreshold: s.lowThreshold,
    costPerUnit: s.costPerUnit,
    supplierId: s.supplierId,
  }))
}

// Bill-of-materials for a representative spread of dishes. Quantities are per
// single serving, in the ingredient's own `unit`. Item ids come straight from
// buildMenu (./menu categories) so they always resolve.
function buildRecipes(): Recipe[] {
  return [
    { itemId: 'qb-005', lines: [{ ingredientId: 'ing-paneer', qty: 0.18 }, { ingredientId: 'ing-tomato', qty: 0.05 }] }, // Paneer Tikka
    { itemId: 'qb-004', lines: [{ ingredientId: 'ing-flour', qty: 0.12 }, { ingredientId: 'ing-cheese', qty: 0.08 }] }, // Cheesy Garlic Bread
    { itemId: 'ita-004', lines: [{ ingredientId: 'ing-flour', qty: 0.2 }, { ingredientId: 'ing-cheese', qty: 0.12 }, { ingredientId: 'ing-tomato', qty: 0.1 }, { ingredientId: 'ing-basil', qty: 0.01 }] }, // Margherita Pizza
    { itemId: 'ita-001', lines: [{ ingredientId: 'ing-pasta', qty: 0.15 }, { ingredientId: 'ing-tomato', qty: 0.12 }] }, // Pasta Arrabbiata
    { itemId: 'ita-006', lines: [{ ingredientId: 'ing-mushroom', qty: 0.1 }, { ingredientId: 'ing-milk', qty: 0.08 }] }, // Risotto ai Funghi
    { itemId: 'soup-001', lines: [{ ingredientId: 'ing-tomato', qty: 0.2 }, { ingredientId: 'ing-basil', qty: 0.01 }] }, // Tomato Basil Bisque
    { itemId: 'soup-002', lines: [{ ingredientId: 'ing-corn', qty: 0.12 }, { ingredientId: 'ing-milk', qty: 0.05 }] }, // Sweet Corn Soup
    { itemId: 'bev-003', lines: [{ ingredientId: 'ing-coffee', qty: 0.02 }, { ingredientId: 'ing-milk', qty: 0.2 }, { ingredientId: 'ing-sugar', qty: 0.02 }] }, // Cold Coffee
  ]
}

function buildPromos(now: number): Promo[] {
  return [
    {
      id: 'promo-happyhour',
      name: 'Happy Hour 20% Off',
      kind: 'percent',
      value: 20,
      active: true,
      startHour: 16,
      endHour: 19,
      createdAt: now - 40 * DAY_MS,
    },
    {
      id: 'promo-flat100',
      name: 'Flat ₹100 Off (orders above ₹999)',
      kind: 'flat',
      value: 100,
      active: true,
      createdAt: now - 22 * DAY_MS,
    },
    {
      id: 'promo-welcome',
      name: 'Welcome Coupon',
      kind: 'coupon',
      value: 15,
      code: 'RELISH15',
      singleUse: true,
      active: false,
      createdAt: now - 10 * DAY_MS,
    },
  ]
}

function buildPurchaseOrders(rng: () => number, now: number): PurchaseOrder[] {
  const orders: PurchaseOrder[] = [
    {
      id: 'po-0001',
      supplierId: 'sup-001',
      lines: [
        { ingredientId: 'ing-paneer', qty: 10, cost: 320 },
        { ingredientId: 'ing-cheese', qty: 6, cost: 520 },
        { ingredientId: 'ing-tomato', qty: 25, cost: 40 },
      ],
      status: 'received',
      createdAt: now - randInt(rng, 6, 9) * DAY_MS,
      receivedAt: now - randInt(rng, 3, 5) * DAY_MS,
    },
    {
      id: 'po-0002',
      supplierId: 'sup-003',
      lines: [
        { ingredientId: 'ing-coffee', qty: 5, cost: 900 },
        { ingredientId: 'ing-mango', qty: 12, cost: 180 },
      ],
      status: 'ordered',
      createdAt: now - randInt(rng, 1, 2) * DAY_MS,
    },
  ]
  return orders
}

function buildWastage(rng: () => number, now: number): WastageEntry[] {
  return [
    {
      id: 'waste-0001',
      ingredientId: 'ing-tomato',
      qty: 2,
      reason: 'Overripe — discarded at close',
      createdAt: now - randInt(rng, 1, 3) * DAY_MS,
    },
    {
      id: 'waste-0002',
      ingredientId: 'ing-milk',
      qty: 3,
      reason: 'Spoiled — fridge temperature excursion',
      createdAt: now - randInt(rng, 0, 1) * DAY_MS - randInt(rng, 1, 8) * 3_600_000,
    },
  ]
}

function buildAudit(rng: () => number, now: number, orders: OrderRecord[], staffIds: string[]): AuditEntry[] {
  const paid = orders.filter(o => o.paid)
  const sample = (i: number): OrderRecord | undefined => paid[Math.floor(rng() * paid.length) + i] ?? paid[0]
  const o1 = sample(0)
  const o2 = sample(1)
  const o3 = sample(2)
  const staff = (i: number): string => staffIds[i % staffIds.length]
  const entries: AuditEntry[] = [
    {
      id: 'aud-0001',
      type: 'void',
      orderId: o1?.id,
      tableId: o1?.tableId,
      amount: o1?.total,
      reason: 'Wrong item fired to kitchen',
      staffId: staff(0),
      createdAt: now - randInt(rng, 1, 4) * DAY_MS,
    },
    {
      id: 'aud-0002',
      type: 'comp',
      orderId: o2?.id,
      tableId: o2?.tableId,
      amount: o2?.total,
      reason: 'Guest waited too long — manager comp',
      staffId: staff(1),
      createdAt: now - randInt(rng, 0, 2) * DAY_MS - randInt(rng, 1, 12) * 3_600_000,
    },
    {
      id: 'aud-0003',
      type: 'discount',
      orderId: o3?.id,
      tableId: o3?.tableId,
      amount: o3 ? Math.round(o3.total * 0.1) : undefined,
      reason: 'Loyalty 10% courtesy discount',
      staffId: staff(2),
      createdAt: now - randInt(rng, 0, 1) * DAY_MS - randInt(rng, 1, 6) * 3_600_000,
    },
  ]
  return entries.sort((a, b) => b.createdAt - a.createdAt)
}

// ── Multi-location / roster / attendance seed data (Phase 3) ────────────────
// Three outlets for the Group dashboard; the first is the currently-active one
// (matching the rest of the seeded single-location dataset).
function buildOutlets(): Outlet[] {
  return [
    { id: 'out-mumbai', name: 'Relish — Bandra', city: 'Mumbai', revenue: 1_842_000, orders: 4120, staff: 18, isCurrent: true },
    { id: 'out-pune', name: 'Relish — Koregaon Park', city: 'Pune', revenue: 1_206_500, orders: 2980, staff: 13, isCurrent: false },
    { id: 'out-bengaluru', name: 'Relish — Indiranagar', city: 'Bengaluru', revenue: 2_310_750, orders: 5240, staff: 22, isCurrent: false },
  ]
}

// This-week roster: each staff member gets one shift per working day, with
// AM/PM windows derived from their assigned shift. Monday-anchored.
function buildShifts(rng: () => number, now: number, staff: Staff[]): Shift[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  // Rewind to Monday of the current week (getDay: 0=Sun … 6=Sat).
  const dow = start.getDay()
  const mondayOffset = (dow + 6) % 7
  const monday = start.getTime() - mondayOffset * DAY_MS

  const shifts: Shift[] = []
  let seq = 0
  staff.forEach(s => {
    if (!s.active) return
    for (let d = 0; d < 6; d++) {
      // Most staff work the bulk of the week; skip the odd day for variety.
      if (rng() < 0.15) continue
      const am = s.shift === 'AM'
      seq += 1
      shifts.push({
        id: `shift-${String(seq).padStart(4, '0')}`,
        staffId: s.id,
        date: monday + d * DAY_MS,
        startHour: am ? 9 : 16,
        endHour: am ? 17 : 24,
      })
    }
  })
  return shifts
}

// A handful of live/closed attendance records for today: some staff clocked in
// (still on the floor), a couple already clocked out.
function buildAttendance(rng: () => number, now: number, staff: Staff[]): Attendance[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const todayMs = start.getTime()
  const active = staff.filter(s => s.active)
  const sample = active.slice(0, Math.min(active.length, 5))
  return sample.map((s, i) => {
    const clockIn = todayMs + (8 + randInt(rng, 0, 2)) * 3_600_000 + randInt(rng, 0, 59) * 60_000
    const closed = i >= sample.length - 2 // last two have clocked out
    return {
      id: `att-${String(i + 1).padStart(4, '0')}`,
      staffId: s.id,
      clockIn,
      clockOut: closed ? clockIn + randInt(rng, 5, 9) * 3_600_000 : undefined,
    }
  })
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
  const staffIds = staff.map(s => s.id)
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
    auditLog: buildAudit(rng, now, orders, staffIds),
    ingredients: buildIngredients(),
    recipes: buildRecipes(),
    suppliers: buildSuppliers(),
    purchaseOrders: buildPurchaseOrders(rng, now),
    wastage: buildWastage(rng, now),
    stockMovements: [],
    promos: buildPromos(now),
    shifts: buildShifts(rng, now, staff),
    attendance: buildAttendance(rng, now, staff),
    outlets: buildOutlets(),
  }
}
