import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('../../lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>()
  return { ...actual, apiFetch }
})

import { ApiError } from '../../lib/api/client'
import {
  listCustomers,
  earnPoints,
  redeemPoints,
  enrollCustomer,
  isInsufficientBalance,
} from './customersApi'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'Aarav Shah',
  phone: '9876500011',
  tier: 'Gold',
  points: 250,
  visits: 4,
  lifetime_spend_minor: 41790,
  tags: ['VIP'],
  last_visit: '2026-06-01T08:00:00Z',
  joined_at: '2026-01-10T08:00:00Z',
  ...over,
})

beforeEach(() => apiFetch.mockReset())

describe('customersApi · listCustomers mapping', () => {
  it('converts paise lifetime spend → rupees (rounded)', async () => {
    apiFetch.mockResolvedValueOnce({ results: [row({ lifetime_spend_minor: 41790 })] })
    const [c] = await listCustomers()
    expect(c.lifetimeSpend).toBe(418) // 41790p = ₹417.90 → 418
  })

  it('rounds half-up and handles zero spend', async () => {
    apiFetch.mockResolvedValueOnce({ results: [row({ lifetime_spend_minor: 12350 }), row({ id: 'c2', lifetime_spend_minor: 0 })] })
    const [a, b] = await listCustomers()
    expect(a.lifetimeSpend).toBe(124) // 123.5 → 124
    expect(b.lifetimeSpend).toBe(0)
  })

  it('maps ISO timestamps → epoch ms and null last_visit → null', async () => {
    const lv = '2026-06-01T08:00:00Z'
    apiFetch.mockResolvedValueOnce({ results: [row({ last_visit: lv }), row({ id: 'c2', last_visit: null })] })
    const [a, b] = await listCustomers()
    expect(a.lastVisit).toBe(Date.parse(lv))
    expect(a.joinedAt).toBe(Date.parse('2026-01-10T08:00:00Z'))
    expect(b.lastVisit).toBeNull()
  })

  it('defaults tags to [] and normalizes a bare array', async () => {
    apiFetch.mockResolvedValueOnce([row({ tags: undefined })])
    const [c] = await listCustomers()
    expect(c.tags).toEqual([])
  })

  it('requests ?limit=500', async () => {
    apiFetch.mockResolvedValueOnce({ results: [] })
    await listCustomers()
    expect(apiFetch).toHaveBeenCalledWith('/crm/customers/?limit=500')
  })
})

describe('customersApi · loyalty CRUD', () => {
  it('earn/redeem POST points to the right action path', async () => {
    apiFetch.mockResolvedValueOnce(row({ points: 300 }))
    await earnPoints('c1', 50)
    expect(apiFetch).toHaveBeenCalledWith('/crm/customers/c1/earn/', { method: 'POST', body: { points: 50 } })

    apiFetch.mockResolvedValueOnce(row({ points: 150 }))
    await redeemPoints('c1', 100)
    expect(apiFetch).toHaveBeenCalledWith('/crm/customers/c1/redeem/', { method: 'POST', body: { points: 100 } })
  })

  it('enroll posts phone + name (empty name when omitted)', async () => {
    apiFetch.mockResolvedValueOnce(row())
    await enrollCustomer('9876500011')
    expect(apiFetch).toHaveBeenCalledWith('/crm/customers/', { method: 'POST', body: { phone: '9876500011', name: '' } })
  })
})

describe('customersApi · isInsufficientBalance', () => {
  it('is true only for an HTTP 400 ApiError', () => {
    expect(isInsufficientBalance(new ApiError(400, { detail: 'Insufficient points' }, 'x'))).toBe(true)
    expect(isInsufficientBalance(new ApiError(409, {}, 'x'))).toBe(false)
    expect(isInsufficientBalance(new Error('boom'))).toBe(false)
  })
})
