// localStorage-backed demo store for the Staff Console.
// Context + useReducer; state is hydrated from localStorage (or freshly seeded)
// and persisted on every change. resetDemoData() regenerates from the seed.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import {
  generateOpsSeed,
  OPS_VERSION,
  type OpsSeed,
} from '../../data/opsSeed'
import type {
  EditableMenuItem,
  TableStatus,
} from '../lib/types'

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
  | { type: 'PAY_TABLES'; tableIds: string[] }
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
      if (parsed.version === OPS_VERSION) return parsed
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
  payTables: (tableIds: string[]) => void
  resetDemoData: () => void
}

const Ctx = createContext<OpsStore | null>(null)

export function OpsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, hydrate)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage may be full or unavailable — demo still works in-memory */
    }
  }, [state])

  const store = useMemo<OpsStore>(
    () => ({
      state,
      setTableStatus: (tableId, status) => dispatch({ type: 'SET_TABLE_STATUS', tableId, status }),
      assignWaiter: (tableId, waiterId) => dispatch({ type: 'ASSIGN_WAITER', tableId, waiterId }),
      seatTable: (tableId, guests, waiterId) => dispatch({ type: 'SEAT_TABLE', tableId, guests, waiterId }),
      clearTable: tableId => dispatch({ type: 'CLEAR_TABLE', tableId }),
      claimRequest: (reqId, staffId) => dispatch({ type: 'CLAIM_REQUEST', reqId, staffId }),
      resolveRequest: reqId => dispatch({ type: 'RESOLVE_REQUEST', reqId }),
      menuCreate: item => dispatch({ type: 'MENU_CREATE', item }),
      menuUpdate: (id, patch) => dispatch({ type: 'MENU_UPDATE', id, patch }),
      menuDelete: id => dispatch({ type: 'MENU_DELETE', id }),
      menuToggleAvailable: id => dispatch({ type: 'MENU_TOGGLE_AVAILABLE', id }),
      menuToggleSoldOut: id => dispatch({ type: 'MENU_TOGGLE_SOLDOUT', id }),
      payTables: tableIds => dispatch({ type: 'PAY_TABLES', tableIds }),
      resetDemoData: () => dispatch({ type: 'RESET' }),
    }),
    [state],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useOpsStore(): OpsStore {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOpsStore must be used within OpsProvider')
  return ctx
}

// Convenience selector used by the Billing screen: unpaid orders for a table.
export { newMenuItem } from './newMenuItem'
