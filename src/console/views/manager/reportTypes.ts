import {
  BarChart3,
  CalendarDays,
  Clock,
  PieChart,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type ReportId =
  | 'daily-sales'
  | 'item-performance'
  | 'peak-hours'
  | 'waiter-productivity'
  | 'category-mix'

export interface ReportMeta {
  id: ReportId
  title: string
  description: string
  icon: LucideIcon
  /** Slug used in the exported CSV filename. */
  slug: string
}

export const REPORTS: ReportMeta[] = [
  {
    id: 'daily-sales',
    title: 'Daily Sales',
    description: 'Revenue and order volume, day by day.',
    icon: CalendarDays,
    slug: 'daily-sales',
  },
  {
    id: 'item-performance',
    title: 'Item Performance',
    description: 'Best-selling dishes by quantity and revenue.',
    icon: BarChart3,
    slug: 'item-performance',
  },
  {
    id: 'peak-hours',
    title: 'Peak Hours',
    description: 'When orders land across the week.',
    icon: Clock,
    slug: 'peak-hours',
  },
  {
    id: 'waiter-productivity',
    title: 'Waiter Productivity',
    description: 'Orders, covers, and revenue per waiter.',
    icon: Users,
    slug: 'waiter-productivity',
  },
  {
    id: 'category-mix',
    title: 'Category Mix',
    description: 'Revenue share across menu categories.',
    icon: PieChart,
    slug: 'category-mix',
  },
]
