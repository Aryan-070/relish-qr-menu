// localStorage-backed demo store for the Staff Console.
// Context + useReducer; state is hydrated from localStorage (or freshly seeded)
// and persisted on every change. resetDemoData() regenerates from the seed.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import {
  generateOpsSeed,
  OPS_VERSION,
  type OpsSeed,
} from '../../data/opsSeed'
import { isSupabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useRealtimeOps, type RealtimeOpsHandlers } from '../lib/useRealtimeOps'
import * as menuRepo from '../lib/menuRepo'
import * as tablesRepo from '../lib/tablesRepo'
import * as ordersRepo from '../lib/ordersRepo'
import * as staffRepo from '../lib/staffRepo'
import * as requestsRepo from '../lib/requestsRepo'
import * as customersRepo from '../lib/customersRepo'
import * as reservationsRepo from '../lib/reservationsRepo'
import * as waitlistRepo from '../lib/waitlistRepo'
import * as feedbackRepo from '../lib/feedbackRepo'
import type {
  Attendance,
  AuditEntry,
  Customer,
  EditableMenuItem,
  Feedback,
  Ingredient,
  OrderRecord,
  OrderStatus,
  Permission,
  Promo,
  PurchaseOrder,
  RecipeLine,
  Reservation,
  ReservationStatus,
  Shift,
  Staff,
  StockMovement,
  Supplier,
  TableStatus,
  WaitlistEntry,
  WastageEntry,
  WaitStatus,
} from '../lib/types'
import { tierForPoints } from '../../data/opsSeed'
import {
  packageById,
  makeInvoice,
  nextInvoiceId,
  type Invoice,
  type PackageId,
} from '../lib/billing'

const YEAR_MS = 365 * 86_400_000

const STORAGE_KEY = 'relish.ops.v1'

export type OpsState = OpsSeed

type Action =
  | { type: 'SET_TABLE_STATUS'; tableId: string; status: TableStatus }
  | { type: 'ASSIGN_WAITER'; tableId: string; waiterId: string | null }
  | { type: 'SEAT_TABLE'; tableId: string; guests: number; waiterId?: string | null }
  | { type: 'CLEAR_TABLE'; tableId: string }
  | { type: 'CLAIM_REQUEST'; reqId: string; staffId: string }
  | { type: 'RESOLVE_REQUEST'; reqId: string }
  | { type: 'MENU_CREATE'; item: EditableMenuItem }
  | { type: 'MENU_UPDATE'; id: string; patch: Partial<EditableMenuItem> }
  | { type: 'MENU_DELETE'; id: string }
  | { type: 'MENU_TOGGLE_AVAILABLE'; id: string }
  | { type: 'MENU_TOGGLE_SOLDOUT'; id: string }
  | { type: 'PLACE_ORDER'; order: OrderRecord }
  | { type: 'SET_ORDER_STATUS'; orderId: string; status: OrderStatus }
  | { type: 'ADD_FEEDBACK'; feedback: Feedback }
  | { type: 'ADD_CUSTOMER'; customer: Customer }
  | { type: 'UPDATE_CUSTOMER'; id: string; patch: Partial<Customer> }
  | { type: 'ADJUST_POINTS'; id: string; delta: number }
  | { type: 'ADD_RESERVATION'; reservation: Reservation }
  | { type: 'SET_RESERVATION_STATUS'; id: string; status: ReservationStatus }
  | { type: 'SEAT_RESERVATION'; id: string; tableId: string }
  | { type: 'ADD_WAITLIST'; entry: WaitlistEntry }
  | { type: 'SET_WAIT_STATUS'; id: string; status: WaitStatus }
  | { type: 'REMOVE_WAITLIST'; id: string }
  | { type: 'PAY_TABLES'; tableIds: string[] }
  | { type: 'BILLING_SET_PACKAGE'; packageId: PackageId }
  | { type: 'BILLING_TOGGLE_AUTORENEW' }
  | { type: 'BILLING_RENEW_NOW' }
  | { type: 'HYDRATE_REMOTE'; snapshot: Partial<OpsState> }
  // Governance / audit (Phase 1)
  | { type: 'ADD_AUDIT'; entry: AuditEntry }
  | { type: 'VOID_ORDER'; orderId: string; reason: string; staffId?: string }
  | { type: 'COMP_ORDER'; orderId: string; reason: string; staffId?: string }
  | { type: 'APPLY_ORDER_DISCOUNT'; orderId: string; pct: number; reason: string; staffId?: string }
  | { type: 'MERGE_TABLES'; sourceTableId: string; targetTableId: string }
  | { type: 'TRANSFER_ORDER'; orderId: string; toTableId: string }
  // Inventory / procurement (Phase 2)
  | { type: 'ADD_INGREDIENT'; ingredient: Ingredient }
  | { type: 'UPDATE_INGREDIENT'; id: string; patch: Partial<Ingredient> }
  | { type: 'SET_RECIPE'; itemId: string; lines: RecipeLine[] }
  | { type: 'ADD_SUPPLIER'; supplier: Supplier }
  | { type: 'ADD_PURCHASE_ORDER'; po: PurchaseOrder }
  | { type: 'RECEIVE_PURCHASE_ORDER'; id: string }
  | { type: 'LOG_WASTAGE'; ingredientId: string; qty: number; reason: string }
  // Promotions (Phase 2)
  | { type: 'ADD_PROMO'; promo: Promo }
  | { type: 'TOGGLE_PROMO'; id: string }
  | { type: 'DELETE_PROMO'; id: string }
  // RBAC / roster / multi-location (Phase 3)
  | { type: 'ADD_STAFF'; staff: Staff }
  | { type: 'UPDATE_STAFF'; id: string; patch: Partial<Staff> }
  | { type: 'REMOVE_STAFF'; id: string }
  | { type: 'SET_STAFF_PERMISSIONS'; id: string; permissions: Permission[] }
  | { type: 'ADD_SHIFT'; shift: Shift }
  | { type: 'UPDATE_SHIFT'; id: string; patch: Partial<Shift> }
  | { type: 'REMOVE_SHIFT'; id: string }
  | { type: 'CLOCK_IN'; staffId: string }
  | { type: 'CLOCK_OUT'; staffId: string }
  | { type: 'SET_CURRENT_OUTLET'; id: string }
  | { type: 'RESET' }

function reducer(state: OpsState, action: Action): OpsState {
  switch (action.type) {
    case 'SET_TABLE_STATUS':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, status: action.status } : t,
        ),
      }
    case 'ASSIGN_WAITER':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId ? { ...t, waiterId: action.waiterId } : t,
        ),
      }
    case 'SEAT_TABLE':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId
            ? {
                ...t,
                status: 'seated',
                guests: action.guests,
                seatedAt: Date.now(),
                waiterId: action.waiterId !== undefined ? action.waiterId : t.waiterId,
              }
            : t,
        ),
      }
    case 'CLEAR_TABLE':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.tableId
            ? { ...t, status: 'available', guests: 0, seatedAt: null }
            : t,
        ),
      }
    case 'CLAIM_REQUEST':
      return {
        ...state,
        requests: state.requests.map(r =>
          r.id === action.reqId ? { ...r, status: 'claimed', claimedBy: action.staffId } : r,
        ),
      }
    case 'RESOLVE_REQUEST':
      return {
        ...state,
        requests: state.requests.map(r =>
          r.id === action.reqId ? { ...r, status: 'resolved' } : r,
        ),
      }
    case 'MENU_CREATE':
      return { ...state, menu: [action.item, ...state.menu] }
    case 'MENU_UPDATE':
      return {
        ...state,
        menu: state.menu.map(m => (m.id === action.id ? { ...m, ...action.patch } : m)),
      }
    case 'MENU_DELETE':
      return { ...state, menu: state.menu.filter(m => m.id !== action.id) }
    case 'MENU_TOGGLE_AVAILABLE':
      return {
        ...state,
        menu: state.menu.map(m => (m.id === action.id ? { ...m, available: !m.available } : m)),
      }
    case 'MENU_TOGGLE_SOLDOUT':
      return {
        ...state,
        menu: state.menu.map(m => (m.id === action.id ? { ...m, soldOut: !m.soldOut } : m)),
      }
    case 'PLACE_ORDER': {
      // A guest scan-to-order: prepend the new ticket and mark the table as
      // ordering so the floor/waiter views reflect it immediately.
      const tableId = action.order.tableId

      // Petpooja-style auto-deduction: walk the order lines, drain the recipe
      // (bill of materials) from each linked ingredient's stock, and log a
      // StockMovement per drained ingredient. Defensive: any line without a
      // recipe, or a recipe line pointing at a missing ingredient, is skipped.
      const stockByIngredient = new Map<string, number>()
      const newMovements: StockMovement[] = []
      for (const line of action.order.lines) {
        const recipe = state.recipes.find(r => r.itemId === line.itemId)
        if (!recipe) continue
        for (const rl of recipe.lines) {
          const ingredient = state.ingredients.find(i => i.id === rl.ingredientId)
          if (!ingredient) continue
          const delta = -(rl.qty * line.qty)
          const prev = stockByIngredient.get(ingredient.id) ?? ingredient.stock
          stockByIngredient.set(ingredient.id, prev + delta)
          newMovements.push({
            id: `mov-${ingredient.id}-${action.order.id}-${newMovements.length}`,
            ingredientId: ingredient.id,
            delta,
            reason: 'order',
            refId: action.order.id,
            createdAt: action.order.placedAt,
          })
        }
      }

      // Apply the new stock levels and detect any ingredient that crossed its
      // low threshold — those auto-86 every menu item whose recipe uses them.
      const depletedIngredientIds = new Set<string>()
      const ingredients = state.ingredients.map(i => {
        const next = stockByIngredient.get(i.id)
        if (next === undefined) return i
        if (next <= i.lowThreshold) depletedIngredientIds.add(i.id)
        return { ...i, stock: next }
      })

      const eightySixedItemIds =
        depletedIngredientIds.size > 0
          ? new Set(
              state.recipes
                .filter(r => r.lines.some(rl => depletedIngredientIds.has(rl.ingredientId)))
                .map(r => r.itemId),
            )
          : new Set<string>()

      const menu =
        eightySixedItemIds.size > 0
          ? state.menu.map(m =>
              eightySixedItemIds.has(m.id) ? { ...m, available: false } : m,
            )
          : state.menu

      return {
        ...state,
        orders: [action.order, ...state.orders],
        ingredients,
        stockMovements:
          newMovements.length > 0
            ? [...newMovements, ...state.stockMovements]
            : state.stockMovements,
        menu,
        tables: state.tables.map(t =>
          // Advance an idle or seated table into 'ordering'; never downgrade a
          // table already further along (bill-requested, paying, etc.).
          t.id === tableId && (t.status === 'available' || t.status === 'seated')
            ? { ...t, status: 'ordering' }
            : t,
        ),
      }
    }
    case 'SET_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, status: action.status } : o,
        ),
      }
    case 'ADD_FEEDBACK':
      return { ...state, feedback: [action.feedback, ...state.feedback] }
    case 'ADD_CUSTOMER':
      return { ...state, customers: [action.customer, ...state.customers] }
    case 'UPDATE_CUSTOMER':
      return {
        ...state,
        customers: state.customers.map(c => (c.id === action.id ? { ...c, ...action.patch } : c)),
      }
    case 'ADJUST_POINTS':
      return {
        ...state,
        customers: state.customers.map(c => {
          if (c.id !== action.id) return c
          const points = Math.max(0, c.points + action.delta)
          return { ...c, points, tier: tierForPoints(points) }
        }),
      }
    case 'ADD_RESERVATION':
      return {
        ...state,
        reservations: [...state.reservations, action.reservation].sort((a, b) => a.at - b.at),
      }
    case 'SET_RESERVATION_STATUS':
      return {
        ...state,
        reservations: state.reservations.map(r =>
          r.id === action.id ? { ...r, status: action.status } : r,
        ),
      }
    case 'SEAT_RESERVATION': {
      // Seating a reservation also occupies the table on the floor.
      const res = state.reservations.find(r => r.id === action.id)
      return {
        ...state,
        reservations: state.reservations.map(r =>
          r.id === action.id ? { ...r, status: 'seated', tableId: action.tableId } : r,
        ),
        tables: state.tables.map(t =>
          t.id === action.tableId
            ? { ...t, status: 'seated', guests: res?.partySize ?? t.guests, seatedAt: Date.now() }
            : t,
        ),
      }
    }
    case 'ADD_WAITLIST':
      return { ...state, waitlist: [...state.waitlist, action.entry] }
    case 'SET_WAIT_STATUS':
      return {
        ...state,
        waitlist: state.waitlist.map(w => (w.id === action.id ? { ...w, status: action.status } : w)),
      }
    case 'REMOVE_WAITLIST':
      return { ...state, waitlist: state.waitlist.filter(w => w.id !== action.id) }
    case 'PAY_TABLES': {
      const ids = new Set(action.tableIds)
      return {
        ...state,
        orders: state.orders.map(o =>
          ids.has(o.tableId) && !o.paid ? { ...o, paid: true } : o,
        ),
        tables: state.tables.map(t =>
          ids.has(t.id) ? { ...t, status: 'available', guests: 0, seatedAt: null } : t,
        ),
        requests: state.requests.map(r =>
          ids.has(r.tableId) && r.type === 'bill' && r.status !== 'resolved'
            ? { ...r, status: 'resolved' }
            : r,
        ),
      }
    }
    case 'BILLING_SET_PACKAGE': {
      const b = state.billing
      if (action.packageId === b.subscription.packageId) return state
      const oldPkg = packageById(b.subscription.packageId)
      const newPkg = packageById(action.packageId)
      // Re-rate any open (due) renewal invoice to the new package's annual price
      // so the history matches what the customer will actually owe.
      const rerated = b.invoices.map(i =>
        i.status === 'due'
          ? makeInvoice(i.id, i.date, `Annual renewal — ${newPkg.name}`, newPkg.renewalYr, 'due')
          : i,
      )
      // On an upgrade, bill the one-time build-fee difference now.
      const delta = newPkg.oneTime - oldPkg.oneTime
      const invoices: Invoice[] =
        delta > 0
          ? [
              makeInvoice(
                nextInvoiceId(rerated),
                Date.now(),
                `Upgrade ${oldPkg.name} → ${newPkg.name} (build fee difference)`,
                delta,
                'paid',
              ),
              ...rerated,
            ]
          : rerated
      return {
        ...state,
        billing: {
          subscription: { ...b.subscription, packageId: action.packageId },
          invoices,
        },
      }
    }
    case 'BILLING_TOGGLE_AUTORENEW':
      return {
        ...state,
        billing: {
          ...state.billing,
          subscription: {
            ...state.billing.subscription,
            autoRenew: !state.billing.subscription.autoRenew,
          },
        },
      }
    case 'BILLING_RENEW_NOW': {
      const b = state.billing
      const pkg = packageById(b.subscription.packageId)
      // Settle the open renewal(s). Keep each invoice's issue date intact —
      // `date` is when it was raised, not when it was paid.
      const settled = b.invoices.map(i =>
        i.status === 'due' ? { ...i, status: 'paid' as const } : i,
      )
      // Anchor the next renewal to today if the subscription was already overdue,
      // so paying always advances the date into the future.
      const nextRenewal = Math.max(b.subscription.renewalAt, Date.now()) + YEAR_MS
      const upcoming = makeInvoice(
        nextInvoiceId(b.invoices),
        nextRenewal,
        `Annual renewal — ${pkg.name}`,
        pkg.renewalYr,
        'due',
      )
      return {
        ...state,
        billing: {
          subscription: { ...b.subscription, renewalAt: nextRenewal },
          invoices: [upcoming, ...settled],
        },
      }
    }
    // ── Governance / audit (Phase 1) ────────────────────────────────────────
    case 'ADD_AUDIT':
      return { ...state, auditLog: [action.entry, ...state.auditLog] }
    case 'VOID_ORDER': {
      const entry: AuditEntry = {
        id: `aud-${Date.now().toString(36)}-${action.orderId}`,
        type: 'void',
        orderId: action.orderId,
        reason: action.reason,
        staffId: action.staffId,
        createdAt: Date.now(),
      }
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, voided: true } : o,
        ),
        auditLog: [entry, ...state.auditLog],
      }
    }
    case 'COMP_ORDER': {
      const entry: AuditEntry = {
        id: `aud-${Date.now().toString(36)}-${action.orderId}`,
        type: 'comp',
        orderId: action.orderId,
        reason: action.reason,
        staffId: action.staffId,
        createdAt: Date.now(),
      }
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, comp: true } : o,
        ),
        auditLog: [entry, ...state.auditLog],
      }
    }
    case 'APPLY_ORDER_DISCOUNT': {
      const entry: AuditEntry = {
        id: `aud-${Date.now().toString(36)}-${action.orderId}`,
        type: 'discount',
        orderId: action.orderId,
        amount: action.pct,
        reason: action.reason,
        staffId: action.staffId,
        createdAt: Date.now(),
      }
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, discountPct: action.pct } : o,
        ),
        auditLog: [entry, ...state.auditLog],
      }
    }
    case 'MERGE_TABLES': {
      const entry: AuditEntry = {
        id: `aud-${Date.now().toString(36)}-merge`,
        type: 'merge',
        tableId: action.sourceTableId,
        reason: `Merged ${action.sourceTableId} → ${action.targetTableId}`,
        createdAt: Date.now(),
      }
      return {
        ...state,
        // Reassign the source table's unpaid orders to the target table.
        orders: state.orders.map(o =>
          o.tableId === action.sourceTableId && !o.paid
            ? { ...o, tableId: action.targetTableId }
            : o,
        ),
        // Clear the now-empty source table.
        tables: state.tables.map(t =>
          t.id === action.sourceTableId
            ? { ...t, status: 'available', guests: 0, waiterId: null, seatedAt: null }
            : t,
        ),
        auditLog: [entry, ...state.auditLog],
      }
    }
    case 'TRANSFER_ORDER': {
      const entry: AuditEntry = {
        id: `aud-${Date.now().toString(36)}-${action.orderId}`,
        type: 'transfer',
        orderId: action.orderId,
        tableId: action.toTableId,
        reason: `Transferred order to ${action.toTableId}`,
        createdAt: Date.now(),
      }
      return {
        ...state,
        orders: state.orders.map(o =>
          o.id === action.orderId ? { ...o, tableId: action.toTableId } : o,
        ),
        auditLog: [entry, ...state.auditLog],
      }
    }
    // ── Inventory / procurement (Phase 2) ───────────────────────────────────
    case 'ADD_INGREDIENT':
      return { ...state, ingredients: [action.ingredient, ...state.ingredients] }
    case 'UPDATE_INGREDIENT':
      return {
        ...state,
        ingredients: state.ingredients.map(i =>
          i.id === action.id ? { ...i, ...action.patch } : i,
        ),
      }
    case 'SET_RECIPE': {
      // Upsert: replace an existing recipe's lines, or append a new one.
      const exists = state.recipes.some(r => r.itemId === action.itemId)
      const recipes = exists
        ? state.recipes.map(r =>
            r.itemId === action.itemId ? { ...r, lines: action.lines } : r,
          )
        : [...state.recipes, { itemId: action.itemId, lines: action.lines }]
      return { ...state, recipes }
    }
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [action.supplier, ...state.suppliers] }
    case 'ADD_PURCHASE_ORDER':
      return { ...state, purchaseOrders: [action.po, ...state.purchaseOrders] }
    case 'RECEIVE_PURCHASE_ORDER': {
      const po = state.purchaseOrders.find(p => p.id === action.id)
      if (!po || po.status === 'received') return state
      const receivedAt = Date.now()
      // Restock each line and log a 'purchase' movement against the ingredient.
      const restockByIngredient = new Map<string, number>()
      const newMovements: StockMovement[] = []
      for (const line of po.lines) {
        restockByIngredient.set(
          line.ingredientId,
          (restockByIngredient.get(line.ingredientId) ?? 0) + line.qty,
        )
        newMovements.push({
          id: `mov-${line.ingredientId}-${po.id}-${newMovements.length}`,
          ingredientId: line.ingredientId,
          delta: line.qty,
          reason: 'purchase',
          refId: po.id,
          createdAt: receivedAt,
        })
      }
      return {
        ...state,
        purchaseOrders: state.purchaseOrders.map(p =>
          p.id === action.id ? { ...p, status: 'received', receivedAt } : p,
        ),
        ingredients: state.ingredients.map(i => {
          const add = restockByIngredient.get(i.id)
          return add === undefined ? i : { ...i, stock: i.stock + add }
        }),
        stockMovements: [...newMovements, ...state.stockMovements],
      }
    }
    case 'LOG_WASTAGE': {
      const createdAt = Date.now()
      const wastageEntry: WastageEntry = {
        id: `wst-${createdAt.toString(36)}-${action.ingredientId}`,
        ingredientId: action.ingredientId,
        qty: action.qty,
        reason: action.reason,
        createdAt,
      }
      const movement: StockMovement = {
        id: `mov-${action.ingredientId}-wst-${createdAt.toString(36)}`,
        ingredientId: action.ingredientId,
        delta: -action.qty,
        reason: 'wastage',
        refId: wastageEntry.id,
        createdAt,
      }
      return {
        ...state,
        ingredients: state.ingredients.map(i =>
          i.id === action.ingredientId ? { ...i, stock: i.stock - action.qty } : i,
        ),
        wastage: [wastageEntry, ...state.wastage],
        stockMovements: [movement, ...state.stockMovements],
      }
    }
    // ── Promotions (Phase 2) ────────────────────────────────────────────────
    case 'ADD_PROMO':
      return { ...state, promos: [action.promo, ...state.promos] }
    case 'TOGGLE_PROMO':
      return {
        ...state,
        promos: state.promos.map(p =>
          p.id === action.id ? { ...p, active: !p.active } : p,
        ),
      }
    case 'DELETE_PROMO':
      return { ...state, promos: state.promos.filter(p => p.id !== action.id) }
    // ── RBAC / roster / multi-location (Phase 3) ────────────────────────────
    case 'ADD_STAFF':
      return { ...state, staff: [action.staff, ...state.staff] }
    case 'UPDATE_STAFF':
      return {
        ...state,
        staff: state.staff.map(s => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }
    case 'REMOVE_STAFF':
      return { ...state, staff: state.staff.filter(s => s.id !== action.id) }
    case 'SET_STAFF_PERMISSIONS':
      return {
        ...state,
        staff: state.staff.map(s =>
          s.id === action.id ? { ...s, permissions: action.permissions } : s,
        ),
      }
    case 'ADD_SHIFT':
      return {
        ...state,
        shifts: [...state.shifts, action.shift].sort((a, b) => a.date - b.date),
      }
    case 'UPDATE_SHIFT':
      return {
        ...state,
        shifts: state.shifts.map(s => (s.id === action.id ? { ...s, ...action.patch } : s)),
      }
    case 'REMOVE_SHIFT':
      return { ...state, shifts: state.shifts.filter(s => s.id !== action.id) }
    case 'CLOCK_IN': {
      // Ignore if the staff member already has an open (un-clocked-out) record.
      const open = state.attendance.some(a => a.staffId === action.staffId && a.clockOut == null)
      if (open) return state
      const clockIn = Date.now()
      const entry: Attendance = {
        id: `att-${clockIn.toString(36)}-${action.staffId}`,
        staffId: action.staffId,
        clockIn,
      }
      return { ...state, attendance: [entry, ...state.attendance] }
    }
    case 'CLOCK_OUT': {
      // Close the most recent open record for this staff member.
      const clockOut = Date.now()
      let closed = false
      return {
        ...state,
        attendance: state.attendance.map(a => {
          if (closed || a.staffId !== action.staffId || a.clockOut != null) return a
          closed = true
          return { ...a, clockOut }
        }),
      }
    }
    case 'SET_CURRENT_OUTLET':
      return {
        ...state,
        outlets: state.outlets.map(o => ({ ...o, isCurrent: o.id === action.id })),
      }
    case 'HYDRATE_REMOTE':
      // Replace the synced entity arrays with a fresh Supabase snapshot. Billing
      // (subscriptions/invoices) is owned by billingRepo, so it's left intact.
      return { ...state, ...action.snapshot }
    case 'RESET':
      return generateOpsSeed()
    default:
      return state
  }
}

function hydrate(): OpsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as OpsState
      // Backfill fields added after a state was first persisted (same version).
      if (parsed.version === OPS_VERSION) {
        return {
          ...parsed,
          feedback: parsed.feedback ?? [],
          customers: parsed.customers ?? [],
          reservations: parsed.reservations ?? [],
          waitlist: parsed.waitlist ?? [],
          // Phase 1/2 arrays — default so older saves don't crash.
          auditLog: parsed.auditLog ?? [],
          ingredients: parsed.ingredients ?? [],
          recipes: parsed.recipes ?? [],
          suppliers: parsed.suppliers ?? [],
          purchaseOrders: parsed.purchaseOrders ?? [],
          wastage: parsed.wastage ?? [],
          stockMovements: parsed.stockMovements ?? [],
          promos: parsed.promos ?? [],
          // Phase 3 arrays — default so older saves don't crash.
          shifts: parsed.shifts ?? [],
          attendance: parsed.attendance ?? [],
          outlets: parsed.outlets ?? [],
        }
      }
    }
  } catch {
    /* ignore corrupt/absent storage */
  }
  return generateOpsSeed()
}

export interface OpsStore {
  state: OpsState
  setTableStatus: (tableId: string, status: TableStatus) => void
  assignWaiter: (tableId: string, waiterId: string | null) => void
  seatTable: (tableId: string, guests: number, waiterId?: string | null) => void
  clearTable: (tableId: string) => void
  claimRequest: (reqId: string, staffId: string) => void
  resolveRequest: (reqId: string) => void
  menuCreate: (item: EditableMenuItem) => void
  menuUpdate: (id: string, patch: Partial<EditableMenuItem>) => void
  menuDelete: (id: string) => void
  menuToggleAvailable: (id: string) => void
  menuToggleSoldOut: (id: string) => void
  placeOrder: (order: OrderRecord) => void
  setOrderStatus: (orderId: string, status: OrderStatus) => void
  addFeedback: (feedback: Feedback) => void
  addCustomer: (customer: Customer) => void
  updateCustomer: (id: string, patch: Partial<Customer>) => void
  adjustPoints: (id: string, delta: number) => void
  addReservation: (reservation: Reservation) => void
  setReservationStatus: (id: string, status: ReservationStatus) => void
  seatReservation: (id: string, tableId: string) => void
  addWaitlist: (entry: WaitlistEntry) => void
  setWaitStatus: (id: string, status: WaitStatus) => void
  removeWaitlist: (id: string) => void
  payTables: (tableIds: string[]) => void
  billingSetPackage: (packageId: PackageId) => void
  billingToggleAutoRenew: () => void
  billingRenewNow: () => void
  // Governance / audit (Phase 1) — demo/localStorage only.
  addAudit: (entry: AuditEntry) => void
  voidOrder: (orderId: string, reason: string, staffId?: string) => void
  compOrder: (orderId: string, reason: string, staffId?: string) => void
  applyOrderDiscount: (orderId: string, pct: number, reason: string, staffId?: string) => void
  mergeTables: (sourceTableId: string, targetTableId: string) => void
  transferOrder: (orderId: string, toTableId: string) => void
  // Inventory / procurement (Phase 2) — demo/localStorage only.
  addIngredient: (i: Ingredient) => void
  updateIngredient: (id: string, patch: Partial<Ingredient>) => void
  setRecipe: (itemId: string, lines: RecipeLine[]) => void
  addSupplier: (s: Supplier) => void
  addPurchaseOrder: (po: PurchaseOrder) => void
  receivePurchaseOrder: (id: string) => void
  logWastage: (ingredientId: string, qty: number, reason: string) => void
  // Promotions (Phase 2) — demo/localStorage only.
  addPromo: (p: Promo) => void
  togglePromo: (id: string) => void
  deletePromo: (id: string) => void
  // RBAC / roster / multi-location (Phase 3) — demo/localStorage only.
  addStaff: (s: Staff) => void
  updateStaff: (id: string, patch: Partial<Staff>) => void
  removeStaff: (id: string) => void
  setStaffPermissions: (id: string, permissions: Permission[]) => void
  addShift: (s: Shift) => void
  updateShift: (id: string, patch: Partial<Shift>) => void
  removeShift: (id: string) => void
  clockIn: (staffId: string) => void
  clockOut: (staffId: string) => void
  setCurrentOutlet: (id: string) => void
  resetDemoData: () => void
}

const Ctx = createContext<OpsStore | null>(null)

/**
 * Load every synced entity for a restaurant from Supabase in parallel and
 * assemble a partial OpsState snapshot. Used on console mount and on each
 * realtime change. Billing is intentionally excluded (owned by billingRepo).
 */
async function loadRemote(restaurantId: string): Promise<Partial<OpsState>> {
  const [menu, tables, orders, requests, staff, customers, reservations, waitlist, feedback] =
    await Promise.all([
      menuRepo.listMenu(restaurantId),
      tablesRepo.listTables(restaurantId),
      ordersRepo.listOrders(restaurantId),
      requestsRepo.listRequests(restaurantId),
      staffRepo.listStaff(restaurantId),
      customersRepo.listCustomers(restaurantId),
      reservationsRepo.listReservations(restaurantId),
      waitlistRepo.listWaitlist(restaurantId),
      feedbackRepo.listFeedback(restaurantId),
    ])
  return { menu, tables, orders, requests, staff, customers, reservations, waitlist, feedback }
}

export function OpsProvider({ children }: { children: ReactNode }) {
  const { restaurantId } = useAuth()
  // Sync is on only for a signed-in staff member (restaurantId set). Anonymous
  // guests have no restaurantId, so they stay 100% local — which also sidesteps
  // RLS (an anonymous Supabase write would be rejected) and keeps the demo intact.
  const syncEnabled = isSupabaseConfigured && !!restaurantId

  // Supabase mode starts from a seed placeholder (replaced by HYDRATE_REMOTE once
  // the tenant loads); demo mode hydrates from localStorage exactly as before.
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    isSupabaseConfigured ? generateOpsSeed : hydrate,
  )

  // Persist to localStorage in demo mode only — never write tenant data there.
  useEffect(() => {
    if (isSupabaseConfigured) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage may be full or unavailable — demo still works in-memory */
    }
  }, [state])

  // Initial load: when a staff member's restaurant resolves, replace the seed
  // placeholder with the live Supabase snapshot.
  useEffect(() => {
    if (!syncEnabled || !restaurantId) return
    let active = true
    void loadRemote(restaurantId)
      .then(snapshot => {
        if (active) dispatch({ type: 'HYDRATE_REMOTE', snapshot })
      })
      .catch(() => {
        /* keep the seed placeholder if the initial load fails */
      })
    return () => {
      active = false
    }
  }, [syncEnabled, restaurantId])

  // Realtime: any change on the ops tables (including from another device)
  // triggers a debounced full reload. Coarse but echo-safe and idempotent.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlers = useMemo<RealtimeOpsHandlers>(() => {
    if (!restaurantId) return {}
    const trigger = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(() => {
        void loadRemote(restaurantId)
          .then(snapshot => dispatch({ type: 'HYDRATE_REMOTE', snapshot }))
          .catch(() => {})
      }, 250)
    }
    const h = { onInsert: trigger, onUpdate: trigger, onDelete: trigger }
    return {
      orders: h,
      order_lines: h,
      restaurant_tables: h,
      service_requests: h,
      menu_items: h,
    }
  }, [restaurantId])
  useRealtimeOps(restaurantId, handlers)

  const store = useMemo<OpsStore>(() => {
    // Mirror a local mutation to Supabase when sync is on. Fire-and-forget:
    // failures are swallowed so a backend hiccup never breaks the optimistic UI.
    const mirror = (run: (rid: string) => Promise<unknown>) => {
      if (syncEnabled && restaurantId) void run(restaurantId).catch(() => {})
    }
    return {
      state,
      setTableStatus: (tableId, status) => {
        dispatch({ type: 'SET_TABLE_STATUS', tableId, status })
        mirror(rid => tablesRepo.setStatus(rid, tableId, status))
      },
      assignWaiter: (tableId, waiterId) => {
        dispatch({ type: 'ASSIGN_WAITER', tableId, waiterId })
        mirror(rid => tablesRepo.assignWaiter(rid, tableId, waiterId))
      },
      seatTable: (tableId, guests, waiterId) => {
        dispatch({ type: 'SEAT_TABLE', tableId, guests, waiterId })
        mirror(rid => tablesRepo.seat(rid, tableId, guests, waiterId))
      },
      clearTable: tableId => {
        dispatch({ type: 'CLEAR_TABLE', tableId })
        mirror(rid => tablesRepo.clear(rid, tableId))
      },
      claimRequest: (reqId, staffId) => {
        dispatch({ type: 'CLAIM_REQUEST', reqId, staffId })
        mirror(rid => requestsRepo.claimRequest(rid, reqId, staffId))
      },
      resolveRequest: reqId => {
        dispatch({ type: 'RESOLVE_REQUEST', reqId })
        mirror(rid => requestsRepo.resolveRequest(rid, reqId))
      },
      menuCreate: item => {
        dispatch({ type: 'MENU_CREATE', item })
        mirror(rid => menuRepo.createMenuItem(rid, item))
      },
      menuUpdate: (id, patch) => {
        dispatch({ type: 'MENU_UPDATE', id, patch })
        const current = state.menu.find(m => m.id === id)
        if (current) mirror(rid => menuRepo.updateMenuItem(rid, { ...current, ...patch }))
      },
      menuDelete: id => {
        dispatch({ type: 'MENU_DELETE', id })
        mirror(rid => menuRepo.deleteMenuItem(rid, id))
      },
      menuToggleAvailable: id => {
        dispatch({ type: 'MENU_TOGGLE_AVAILABLE', id })
        const current = state.menu.find(m => m.id === id)
        if (current) mirror(rid => menuRepo.setAvailable(rid, id, !current.available))
      },
      menuToggleSoldOut: id => {
        dispatch({ type: 'MENU_TOGGLE_SOLDOUT', id })
        const current = state.menu.find(m => m.id === id)
        if (current) mirror(rid => menuRepo.setSoldOut(rid, id, !current.soldOut))
      },
      placeOrder: order => {
        dispatch({ type: 'PLACE_ORDER', order })
        mirror(rid => ordersRepo.createOrder(rid, order))
      },
      setOrderStatus: (orderId, status) => {
        dispatch({ type: 'SET_ORDER_STATUS', orderId, status })
        mirror(rid => ordersRepo.setOrderStatus(rid, orderId, status))
      },
      addFeedback: feedback => {
        dispatch({ type: 'ADD_FEEDBACK', feedback })
        mirror(rid => feedbackRepo.createFeedback(rid, feedback))
      },
      addCustomer: customer => {
        dispatch({ type: 'ADD_CUSTOMER', customer })
        mirror(rid => customersRepo.createCustomer(rid, customer))
      },
      updateCustomer: (id, patch) => {
        dispatch({ type: 'UPDATE_CUSTOMER', id, patch })
        mirror(rid => customersRepo.updateCustomer(rid, id, patch))
      },
      adjustPoints: (id, delta) => {
        dispatch({ type: 'ADJUST_POINTS', id, delta })
        const current = state.customers.find(c => c.id === id)
        if (current) {
          const points = Math.max(0, current.points + delta)
          mirror(rid => customersRepo.adjustPoints(rid, id, points, tierForPoints(points)))
        }
      },
      addReservation: reservation => {
        dispatch({ type: 'ADD_RESERVATION', reservation })
        mirror(rid => reservationsRepo.createReservation(rid, reservation))
      },
      setReservationStatus: (id, status) => {
        dispatch({ type: 'SET_RESERVATION_STATUS', id, status })
        mirror(rid => reservationsRepo.setReservationStatus(rid, id, status))
      },
      seatReservation: (id, tableId) => {
        dispatch({ type: 'SEAT_RESERVATION', id, tableId })
        const res = state.reservations.find(r => r.id === id)
        mirror(rid =>
          Promise.all([
            reservationsRepo.seatReservation(rid, id, tableId),
            tablesRepo.seat(rid, tableId, res?.partySize ?? 0),
          ]),
        )
      },
      addWaitlist: entry => {
        dispatch({ type: 'ADD_WAITLIST', entry })
        mirror(rid => waitlistRepo.createWaitlistEntry(rid, entry))
      },
      setWaitStatus: (id, status) => {
        dispatch({ type: 'SET_WAIT_STATUS', id, status })
        mirror(rid => waitlistRepo.setWaitStatus(rid, id, status))
      },
      removeWaitlist: id => {
        dispatch({ type: 'REMOVE_WAITLIST', id })
        mirror(rid => waitlistRepo.removeWaitlistEntry(rid, id))
      },
      payTables: tableIds => {
        dispatch({ type: 'PAY_TABLES', tableIds })
        const billReqs = state.requests.filter(
          r => tableIds.includes(r.tableId) && r.type === 'bill' && r.status !== 'resolved',
        )
        mirror(rid =>
          Promise.all([
            ordersRepo.settleTables(rid, tableIds),
            ...tableIds.map(t => tablesRepo.clear(rid, t)),
            ...billReqs.map(r => requestsRepo.resolveRequest(rid, r.id)),
          ]),
        )
      },
      // Billing (subscriptions/invoices) is owned by billingRepo + the dashboard;
      // these stay local in the ops store and aren't mirrored here.
      billingSetPackage: packageId => dispatch({ type: 'BILLING_SET_PACKAGE', packageId }),
      billingToggleAutoRenew: () => dispatch({ type: 'BILLING_TOGGLE_AUTORENEW' }),
      billingRenewNow: () => dispatch({ type: 'BILLING_RENEW_NOW' }),
      // Governance / audit (Phase 1) — demo/localStorage only, not mirrored.
      addAudit: entry => dispatch({ type: 'ADD_AUDIT', entry }),
      voidOrder: (orderId, reason, staffId) =>
        dispatch({ type: 'VOID_ORDER', orderId, reason, staffId }),
      compOrder: (orderId, reason, staffId) =>
        dispatch({ type: 'COMP_ORDER', orderId, reason, staffId }),
      applyOrderDiscount: (orderId, pct, reason, staffId) =>
        dispatch({ type: 'APPLY_ORDER_DISCOUNT', orderId, pct, reason, staffId }),
      mergeTables: (sourceTableId, targetTableId) =>
        dispatch({ type: 'MERGE_TABLES', sourceTableId, targetTableId }),
      transferOrder: (orderId, toTableId) =>
        dispatch({ type: 'TRANSFER_ORDER', orderId, toTableId }),
      // Inventory / procurement (Phase 2) — demo/localStorage only, not mirrored.
      addIngredient: i => dispatch({ type: 'ADD_INGREDIENT', ingredient: i }),
      updateIngredient: (id, patch) => dispatch({ type: 'UPDATE_INGREDIENT', id, patch }),
      setRecipe: (itemId, lines) => dispatch({ type: 'SET_RECIPE', itemId, lines }),
      addSupplier: s => dispatch({ type: 'ADD_SUPPLIER', supplier: s }),
      addPurchaseOrder: po => dispatch({ type: 'ADD_PURCHASE_ORDER', po }),
      receivePurchaseOrder: id => dispatch({ type: 'RECEIVE_PURCHASE_ORDER', id }),
      logWastage: (ingredientId, qty, reason) =>
        dispatch({ type: 'LOG_WASTAGE', ingredientId, qty, reason }),
      // Promotions (Phase 2) — demo/localStorage only, not mirrored.
      addPromo: p => dispatch({ type: 'ADD_PROMO', promo: p }),
      togglePromo: id => dispatch({ type: 'TOGGLE_PROMO', id }),
      deletePromo: id => dispatch({ type: 'DELETE_PROMO', id }),
      // RBAC / roster / multi-location (Phase 3) — demo/localStorage only, not mirrored.
      addStaff: s => dispatch({ type: 'ADD_STAFF', staff: s }),
      updateStaff: (id, patch) => dispatch({ type: 'UPDATE_STAFF', id, patch }),
      removeStaff: id => dispatch({ type: 'REMOVE_STAFF', id }),
      setStaffPermissions: (id, permissions) =>
        dispatch({ type: 'SET_STAFF_PERMISSIONS', id, permissions }),
      addShift: s => dispatch({ type: 'ADD_SHIFT', shift: s }),
      updateShift: (id, patch) => dispatch({ type: 'UPDATE_SHIFT', id, patch }),
      removeShift: id => dispatch({ type: 'REMOVE_SHIFT', id }),
      clockIn: staffId => dispatch({ type: 'CLOCK_IN', staffId }),
      clockOut: staffId => dispatch({ type: 'CLOCK_OUT', staffId }),
      setCurrentOutlet: id => dispatch({ type: 'SET_CURRENT_OUTLET', id }),
      resetDemoData: () => dispatch({ type: 'RESET' }),
    }
  }, [state, syncEnabled, restaurantId])

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useOpsStore(): OpsStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOpsStore must be used within OpsProvider')
  return ctx
}

// Convenience selector used by the Billing screen: unpaid orders for a table.
export { newMenuItem } from './newMenuItem'
