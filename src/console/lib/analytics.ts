// Pure analytics selectors over the order history. No React, no side effects —
// views call these inside useMemo keyed on (orders, range).

import { getCategoryById } from '../../data/menu'
import type {
  CategorySlice,
  EditableMenuItem,
  HeatCell,
  Kpis,
  OrderRecord,
  Staff,
  StaffPerf,
  TopItem,
  TrendPoint,
} from './types'

const DAY_MS = 86_400_000

function windowStart(days: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime() - (days - 1) * DAY_MS
}

/** Orders placed within the last `days` (inclusive of today). */
export function ordersInRange(orders: OrderRecord[], days: number): OrderRecord[] {
  const start = windowStart(days)
  return orders.filter(o => o.placedAt >= start)
}

function ordersInPrevRange(orders: OrderRecord[], days: number): OrderRecord[] {
  const start = windowStart(days)
  const prevStart = start - days * DAY_MS
  return orders.filter(o => o.placedAt >= prevStart && o.placedAt < start)
}

const sumRevenue = (orders: OrderRecord[]): number => orders.reduce((s, o) => s + o.total, 0)
const sumCovers = (orders: OrderRecord[]): number =>
  orders.reduce((s, o) => s + o.lines.reduce((q, l) => q + l.qty, 0), 0)

const delta = (curr: number, prev: number): number =>
  prev === 0 ? (curr > 0 ? 1 : 0) : (curr - prev) / prev

export function computeKpis(orders: OrderRecord[], days: number, tableCount: number): Kpis {
  const curr = ordersInRange(orders, days)
  const prev = ordersInPrevRange(orders, days)
  const revenue = sumRevenue(curr)
  const prevRevenue = sumRevenue(prev)
  const ordersCount = curr.length
  const covers = sumCovers(curr)
  const aov = ordersCount ? revenue / ordersCount : 0
  const prevAov = prev.length ? prevRevenue / prev.length : 0

  return {
    revenue,
    orders: ordersCount,
    aov,
    covers,
    turnover: tableCount ? ordersCount / tableCount : 0,
    revenueDelta: delta(revenue, prevRevenue),
    ordersDelta: delta(ordersCount, prev.length),
    aovDelta: delta(aov, prevAov),
    coversDelta: delta(covers, sumCovers(prev)),
    revenueSpark: revenueTrend(orders, days).map(p => p.revenue),
  }
}

export function topItems(orders: OrderRecord[], days: number, limit = 8): TopItem[] {
  const curr = ordersInRange(orders, days)
  const map = new Map<string, TopItem>()
  for (const o of curr) {
    for (const l of o.lines) {
      const existing = map.get(l.itemId)
      if (existing) {
        existing.qty += l.qty
        existing.revenue += l.price * l.qty
      } else {
        map.set(l.itemId, {
          itemId: l.itemId,
          name: l.name,
          categoryId: l.categoryId,
          qty: l.qty,
          revenue: l.price * l.qty,
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

export function revenueTrend(orders: OrderRecord[], days: number): TrendPoint[] {
  const start = windowStart(days)
  const buckets: TrendPoint[] = []
  for (let i = 0; i < days; i++) {
    const ts = start + i * DAY_MS
    buckets.push({
      ts,
      label: new Date(ts).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
      revenue: 0,
      orders: 0,
    })
  }
  for (const o of orders) {
    if (o.placedAt < start) continue
    const idx = Math.floor((o.placedAt - start) / DAY_MS)
    if (idx < 0 || idx >= buckets.length) continue
    buckets[idx].revenue += o.total
    buckets[idx].orders += 1
  }
  return buckets
}

// Peak-time grid: rows = weekday (Mon→Sun), cols = service hours.
export const HEATMAP_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
export const HEATMAP_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function peakHeatmap(orders: OrderRecord[], days: number): HeatCell[] {
  const curr = ordersInRange(orders, days)
  const cells = new Map<string, HeatCell>()
  for (const day of HEATMAP_DAYS.keys()) {
    for (const hour of HEATMAP_HOURS) {
      cells.set(`${day}-${hour}`, { day, hour, count: 0 })
    }
  }
  for (const o of curr) {
    const d = new Date(o.placedAt)
    const jsDow = d.getDay() // 0=Sun
    const day = jsDow === 0 ? 6 : jsDow - 1 // Mon=0 … Sun=6
    const hour = d.getHours()
    const cell = cells.get(`${day}-${hour}`)
    if (cell) cell.count += 1
  }
  return [...cells.values()]
}

export function categoryMix(orders: OrderRecord[], days: number): CategorySlice[] {
  const curr = ordersInRange(orders, days)
  const map = new Map<string, CategorySlice>()
  for (const o of curr) {
    for (const l of o.lines) {
      const existing = map.get(l.categoryId)
      const rev = l.price * l.qty
      if (existing) {
        existing.revenue += rev
        existing.qty += l.qty
      } else {
        map.set(l.categoryId, {
          categoryId: l.categoryId,
          name: getCategoryById(l.categoryId)?.name ?? l.categoryId,
          revenue: rev,
          qty: l.qty,
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export function staffPerformance(orders: OrderRecord[], staff: Staff[], days: number): StaffPerf[] {
  const curr = ordersInRange(orders, days)
  const waiters = staff.filter(s => s.role === 'waiter')
  const rows = waiters.map<StaffPerf>(w => {
    const mine = curr.filter(o => o.waiterId === w.id)
    const revenue = sumRevenue(mine)
    return {
      staffId: w.id,
      name: w.name,
      orders: mine.length,
      revenue,
      covers: sumCovers(mine),
      avgTicket: mine.length ? revenue / mine.length : 0,
    }
  })
  return rows.sort((a, b) => b.revenue - a.revenue)
}

export interface BusyTable {
  tableId: string
  orders: number
  revenue: number
}

export function busiestTables(orders: OrderRecord[], days: number, limit = 6): BusyTable[] {
  const curr = ordersInRange(orders, days)
  const map = new Map<string, BusyTable>()
  for (const o of curr) {
    const e = map.get(o.tableId)
    if (e) {
      e.orders += 1
      e.revenue += o.total
    } else {
      map.set(o.tableId, { tableId: o.tableId, orders: 1, revenue: o.total })
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function itemById(menu: EditableMenuItem[], id: string): EditableMenuItem | undefined {
  return menu.find(m => m.id === id)
}
