// Domain model for the Relish Staff Console (UI-only demo).
// All data is client-side mock data; see opsSeed.ts for generation and
// useOpsStore.ts for the localStorage-backed store.

export type Role = 'admin' | 'manager' | 'waiter'

export type TableStatus =
  | 'available'
  | 'seated'
  | 'ordering'
  | 'bill-requested'
  | 'needs-attention'

export type Zone = 'Garden' | 'Indoor' | 'Patio' | 'Bar'

export interface Table {
  id: string // 'T01'
  label: string // 'Table 1'
  seats: number
  zone: Zone
  status: TableStatus
  waiterId: string | null
  guests: number // current covers (0 when available)
  seatedAt: number | null // epoch ms
}

export interface OrderLine {
  itemId: string
  name: string
  price: number
  qty: number
  categoryId: string
  /** Selected modifiers, as a display string (e.g. "Extra cheese · Jalapeños"). */
  modifiers?: string
  /** Free-text kitchen note from the guest. */
  note?: string
  /** Seat number this line is assigned to (for by-seat splits). */
  seat?: number
}

/** Kitchen ticket lifecycle, driven from the KDS. */
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'served'

export interface OrderRecord {
  id: string // 'ORD-00123'
  tableId: string
  waiterId: string
  placedAt: number // epoch ms
  lines: OrderLine[]
  total: number
  paid: boolean
  /** Kitchen status. Absent on legacy/seed orders (treated as in-progress when unpaid). */
  status?: OrderStatus
  /** Channel the order came from — distinguishes guest scan-to-order from staff entry. */
  source?: 'guest' | 'staff'
  /** Voided by staff (governance/audit). Excluded from revenue. */
  voided?: boolean
  /** Comped by staff (on the house). Excluded from revenue. */
  comp?: boolean
  /** Manager discount applied to this order, as a percentage (0–100). */
  discountPct?: number
}

// ── RBAC / roster / multi-location (Phase 3) ────────────────────────────────
/** Granular staff capabilities, gated per role and editable in Staff Admin. */
export type Permission =
  | 'void'
  | 'comp'
  | 'discount'
  | 'refund'
  | 'edit-menu'
  | 'manage-stock'
  | 'manage-staff'
  | 'view-reports'
  | 'manage-billing'
  | 'manage-theme'

export interface Staff {
  id: string // 'W1'
  name: string
  role: Role
  shift: 'AM' | 'PM'
  hue: number // 0-360, drives the generated avatar tint
  /** Granular permissions; defaults seeded by role (admin=all, manager=most, waiter=minimal). */
  permissions: Permission[]
  /** Whether the staff member is active (vs. deactivated). */
  active: boolean
  /** Optional contact email. */
  email?: string
}

/** A scheduled shift for a staff member (roster). */
export interface Shift {
  id: string
  staffId: string
  date: number // epoch ms — day of the shift
  startHour: number // 0–23
  endHour: number // 0–23
}

/** A clock-in/clock-out record (attendance). */
export interface Attendance {
  id: string
  staffId: string
  clockIn: number // epoch ms
  clockOut?: number // epoch ms — absent while still clocked in
}

/** A location/outlet in a multi-venue group. */
export interface Outlet {
  id: string
  name: string
  city: string
  revenue: number // rupees
  orders: number
  staff: number
  isCurrent: boolean
}

export type RequestType = 'waiter' | 'water' | 'bill' | 'assistance' | 'cleanup'
export type RequestStatus = 'pending' | 'claimed' | 'resolved'

/** Post-visit guest feedback (star rating + optional comment), captured in-app. */
export interface Feedback {
  id: string
  /** 1–5 stars. */
  rating: number
  comment?: string
  tableId?: string
  createdAt: number // epoch ms
  /** Whether the guest was routed to a public review (high rating) or kept private. */
  routedToPublic: boolean
}

// ── Loyalty / CRM ───────────────────────────────────────────────────────────
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

/** A loyalty/CRM customer profile. */
export interface Customer {
  id: string
  name: string
  phone: string
  points: number
  tier: LoyaltyTier
  visits: number
  lifetimeSpend: number // rupees
  tags: string[]
  lastVisit: number // epoch ms
  joinedAt: number // epoch ms
}

// ── Reservations / waitlist ─────────────────────────────────────────────────
export type ReservationStatus = 'booked' | 'seated' | 'completed' | 'cancelled' | 'no-show'

export interface Reservation {
  id: string
  name: string
  phone: string
  partySize: number
  at: number // epoch ms — the booked time
  tableId: string | null
  status: ReservationStatus
  notes?: string
  createdAt: number
}

export type WaitStatus = 'waiting' | 'notified' | 'seated' | 'left'

export interface WaitlistEntry {
  id: string
  name: string
  phone?: string
  partySize: number
  quotedMins: number
  status: WaitStatus
  addedAt: number // epoch ms
}

export interface ServiceRequest {
  id: string
  tableId: string
  type: RequestType
  createdAt: number
  status: RequestStatus
  claimedBy: string | null
  note?: string
}

// A menu item flattened + made editable for CRUD. Seeded from data/menu.ts.
export interface EditableMenuItem {
  id: string
  name: string
  price: number
  description: string
  categoryId: string
  tags: string[]
  customizations: string[]
  isJain: boolean
  canBeJain: boolean
  chefsSpecial: boolean
  spiceLevel: 0 | 1 | 2 | 3
  available: boolean
  soldOut: boolean
  /** Photo: an /assets path, a pasted URL, or an uploaded data URL. */
  imageUrl?: string
  /** Short looping video: a URL or uploaded data URL. */
  videoUrl?: string
  /** Extra marketing / dietary labels (see MENU_BADGES). */
  badges: string[]
  /** Modifier/add-on groups attached to this item (e.g. size, extras). */
  modifierGroups?: import('../../data/modifiers').ModifierGroup[]
  /** Per-item GST/HSN rate as a percentage; falls back to 5 when absent. */
  taxRatePct?: number
}

/** Selectable marketing / dietary labels for the menu editor. */
export const MENU_BADGES = [
  'New',
  'Popular',
  'Bestseller',
  'Seasonal',
  'Vegan',
  'Vegetarian',
  'Gluten-free',
  'Contains nuts',
] as const
export type MenuBadge = (typeof MENU_BADGES)[number]

// ── Billing (split / merge are computed in the Billing view) ────────────────
export type SplitMode = 'none' | 'even' | 'by-guest'

export interface BillTotals {
  subtotal: number
  discountPct: number
  discountAmount: number
  serviceCharge: number
  tax: number
  total: number
  perHead: number | null
}

// ── Analytics result shapes ─────────────────────────────────────────────────
export interface DateRange {
  days: 7 | 14 | 30
  label: string
}

export interface Kpis {
  revenue: number
  orders: number
  aov: number
  covers: number
  turnover: number // avg orders per table over the window
  revenueDelta: number // fractional change vs previous period (e.g. 0.12 = +12%)
  ordersDelta: number
  aovDelta: number
  coversDelta: number
  revenueSpark: number[] // per-day revenue for the KPI sparkline
}

export interface TopItem {
  itemId: string
  name: string
  categoryId: string
  qty: number
  revenue: number
}

export interface TrendPoint {
  ts: number
  label: string // 'Jun 02'
  revenue: number
  orders: number
}

export interface HeatCell {
  day: number // 0=Mon … 6=Sun
  hour: number // 24h
  count: number
}

export interface CategorySlice {
  categoryId: string
  name: string
  revenue: number
  qty: number
}

export interface StaffPerf {
  staffId: string
  name: string
  orders: number
  revenue: number
  covers: number
  avgTicket: number
}

export const DATE_RANGES: DateRange[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
]

// ── Governance / audit (Phase 1) ────────────────────────────────────────────
export type AuditType = 'void' | 'comp' | 'discount' | 'merge' | 'transfer'

export interface AuditEntry {
  id: string
  type: AuditType
  orderId?: string
  tableId?: string
  amount?: number
  reason: string
  staffId?: string
  createdAt: number
}

// ── Inventory / procurement (Phase 2) ───────────────────────────────────────
export interface Ingredient {
  id: string
  name: string
  unit: string
  stock: number
  lowThreshold: number
  costPerUnit: number
  supplierId?: string
}

export interface RecipeLine {
  ingredientId: string
  qty: number
}

export interface Recipe {
  itemId: string
  lines: RecipeLine[]
}

export interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
}

export type PoStatus = 'draft' | 'ordered' | 'received'

export interface PurchaseOrder {
  id: string
  supplierId: string
  lines: { ingredientId: string; qty: number; cost: number }[]
  status: PoStatus
  createdAt: number
  receivedAt?: number
}

export interface WastageEntry {
  id: string
  ingredientId: string
  qty: number
  reason: string
  createdAt: number
}

export interface StockMovement {
  id: string
  ingredientId: string
  delta: number
  reason: 'order' | 'purchase' | 'wastage' | 'adjust'
  refId?: string
  createdAt: number
}

// ── Promotions (Phase 2) ────────────────────────────────────────────────────
export type PromoKind = 'percent' | 'flat' | 'coupon'

export interface Promo {
  id: string
  name: string
  kind: PromoKind
  value: number
  code?: string
  singleUse?: boolean
  active: boolean
  startHour?: number
  endHour?: number
  createdAt: number
}
