import { createContext, useContext, type ReactNode } from 'react'
import type { ConsoleView } from './nav'
import type { DateRange, Role } from './lib/types'

export interface ViewContextValue {
  role: Role
  dateRange: DateRange
  /** The "logged-in" waiter for waiter-role demo screens. */
  currentWaiterId: string
  /** Navigate to another console view. */
  navigate: (view: ConsoleView) => void
  /** Table the Billing screen should open focused on (null = none). */
  billingFocusTableId: string | null
  /** Jump to the Billing screen focused on a table. */
  focusBilling: (tableId: string) => void
}

const Ctx = createContext<ViewContextValue | null>(null)

export function ViewProvider({ value, children }: { value: ViewContextValue; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useViewCtx(): ViewContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useViewCtx must be used within ViewProvider')
  return ctx
}
