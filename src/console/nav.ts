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
  Boxes,
  Tags,
  ReceiptText,
  ShieldCheck,
  CalendarClock,
  Building2,
  UserPlus,
  KeyRound,
  Palette,
  type LucideIcon,
} from 'lucide-react'
import type { Permission, Role } from './lib/types'

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
  | 'inventory'
  | 'promotions'
  | 'cash-loss'
  | 'staff-admin'
  | 'staff-management'
  | 'password-approvals'
  | 'password-request'
  | 'appearance'
  | 'roster'
  | 'group'

export interface NavItem {
  view: ConsoleView
  label: string
  icon: LucideIcon
  /** Live-count badge source, resolved by the shell. */
  badge?: 'pending-requests'
  /** Hide this item unless the signed-in user holds this permission. */
  requires?: Permission
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
    { view: 'staff-management', label: 'Staff Accounts', icon: UserPlus, requires: 'manage-staff' },
    { view: 'password-approvals', label: 'Password Requests', icon: KeyRound, requires: 'manage-staff' },
    { view: 'appearance', label: 'Appearance', icon: Palette, requires: 'manage-theme' },
    { view: 'staff-admin', label: 'Staff Admin', icon: ShieldCheck },
    { view: 'roster', label: 'Roster', icon: CalendarClock },
    { view: 'group', label: 'Group', icon: Building2 },
    { view: 'inventory', label: 'Inventory', icon: Boxes },
    { view: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { view: 'loyalty', label: 'Loyalty', icon: Gift },
    { view: 'feedback', label: 'Feedback', icon: MessageSquare },
    { view: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { view: 'promotions', label: 'Promotions', icon: Tags },
    { view: 'table-qr', label: 'QR Codes', icon: QrCode },
    { view: 'cash-loss', label: 'Cash & Loss', icon: ReceiptText },
    { view: 'admin-billing', label: 'Billing', icon: CreditCard },
  ],
  manager: [
    { view: 'manager-floor', label: 'Floor', icon: LayoutGrid },
    { view: 'kds', label: 'Kitchen', icon: ChefHat },
    { view: 'reservations', label: 'Reservations', icon: CalendarCheck },
    { view: 'manager-menu', label: 'Menu', icon: UtensilsCrossed },
    { view: 'manager-staff', label: 'Staff', icon: Users },
    { view: 'staff-management', label: 'Staff Accounts', icon: UserPlus, requires: 'manage-staff' },
    { view: 'password-approvals', label: 'Password Requests', icon: KeyRound, requires: 'manage-staff' },
    { view: 'appearance', label: 'Appearance', icon: Palette, requires: 'manage-theme' },
    { view: 'roster', label: 'Roster', icon: CalendarClock },
    { view: 'inventory', label: 'Inventory', icon: Boxes },
    { view: 'loyalty', label: 'Loyalty', icon: Gift },
    { view: 'feedback', label: 'Feedback', icon: MessageSquare },
    { view: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { view: 'promotions', label: 'Promotions', icon: Tags },
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
    { view: 'password-request', label: 'My Password', icon: KeyRound },
  ],
}

export function defaultViewFor(role: Role): ConsoleView {
  return NAV[role][0].view
}
