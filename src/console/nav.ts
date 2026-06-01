import {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Users,
  LayoutGrid,
  BellRing,
  Receipt,
  History,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from './lib/types'

export type ConsoleView =
  | 'admin-dashboard'
  | 'reports'
  | 'records'
  | 'manager-floor'
  | 'manager-menu'
  | 'manager-staff'
  | 'waiter-tables'
  | 'waiter-queue'
  | 'waiter-billing'

export interface NavItem {
  view: ConsoleView
  label: string
  icon: LucideIcon
  /** Live-count badge source, resolved by the shell. */
  badge?: 'pending-requests'
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manager: 'Manager',
  waiter: 'Waiter',
}

export const NAV: Record<Role, NavItem[]> = {
  admin: [
    { view: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'reports', label: 'Reports', icon: BarChart3 },
    { view: 'records', label: 'Records', icon: History },
    { view: 'manager-menu', label: 'Menu', icon: UtensilsCrossed },
    { view: 'manager-staff', label: 'Staff', icon: Users },
  ],
  manager: [
    { view: 'manager-floor', label: 'Floor', icon: LayoutGrid },
    { view: 'manager-menu', label: 'Menu', icon: UtensilsCrossed },
    { view: 'manager-staff', label: 'Staff', icon: Users },
    { view: 'reports', label: 'Reports', icon: BarChart3 },
    { view: 'records', label: 'Records', icon: History },
  ],
  waiter: [
    { view: 'waiter-tables', label: 'My Tables', icon: LayoutGrid },
    { view: 'waiter-queue', label: 'Service Queue', icon: BellRing, badge: 'pending-requests' },
    { view: 'waiter-billing', label: 'Billing', icon: Receipt },
    { view: 'records', label: 'Records', icon: History },
  ],
}

export function defaultViewFor(role: Role): ConsoleView {
  return NAV[role][0].view
}
