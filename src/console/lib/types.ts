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
}

export interface OrderRecord {
  id: string // 'ORD-00123'
  tableId: string
  waiterId: string
  placedAt: number // epoch ms
  lines: OrderLine[]
  total: number
  paid: boolean
}

export interface Staff {
  id: string // 'W1'
  name: string
  role: Role
  shift: 'AM' | 'PM'
  hue: number // 0-360, drives the generated avatar tint
}

export type RequestType = 'waiter' | 'water' | 'bill' | 'assistance' | 'cleanup'
export type RequestStatus = 'pending' | 'claimed' | 'resolved'

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
