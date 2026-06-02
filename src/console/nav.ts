import {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Users,
  LayoutGrid,
  BellRing,
  Receipt,
  History,
  CreditCard,
  ChefHat,
  QrCode,
  CalendarCheck,
  Gift,
  MessageSquare,
  Megaphone,
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
  | 'admin-billing'
  | 'waiter-tables'
  | 'waiter-queue'
  | 'waiter-billing'
  | 'kds'
  | 'table-qr'
  | 'reservations'
  | 'loyalty'
  | 'feedback'
  | 'campaigns'

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
    { view: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { view: 'loyalty', label: 'Loyalty', icon: Gift },
    { view: 'feedback', label: 'Feedback', icon: MessageSquare },
    { view: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { view: 'table-qr', label: 'QR Codes', icon: QrCode },
    { view: 'admin-billing', label: 'Billing', icon: CreditCard },
  ],
  manager: [
    { view: 'manager-floor', label: 'Floor', icon: LayoutGrid },
    { view: 'kds', label: 'Kitchen', icon: ChefHat },
    { view: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { view: 'manager-menu', label: 'Menu', icon: UtensilsCrossed },
    { view: 'manager-staff', label: 'Staff', icon: Users },
    { view: 'loyalty', label: 'Loyalty', icon: Gift },
    { view: 'feedback', label: 'Feedback', icon: MessageSquare },
    { view: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { view: 'table-qr', label: 'QR Codes', icon: QrCode },
    { view: 'reports', label: 'Reports', icon: BarChart3 },
    { view: 'records', label: 'Records', icon: History },
  ],
  waiter: [
    { view: 'waiter-tables', label: 'My Tables', icon: LayoutGrid },
    { view: 'kds', label: 'Kitchen', icon: ChefHat },
    { view: 'waiter-queue', label: 'Service Queue', icon: BellRing, badge: 'pending-requests' },
    { view: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { view: 'waiter-billing', label: 'Billing', icon: Receipt },
    { view: 'records', label: 'Records', icon: History },
  ],
}

export function defaultViewFor(role: Role): ConsoleView {
  return NAV[role][0].view
}
