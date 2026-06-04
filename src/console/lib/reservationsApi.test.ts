import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('../../lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>()
  return { ...actual, apiFetch }
})

import { listReservations } from './reservationsApi'

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  customer: 'c1',
  name: 'Mehta party',
  phone: '9000000001',
  party_size: 4,
  at: '2026-06-04T19:30:00Z',
  table_id: 't3',
  status: 'booked',
  notes: 'window seat',
  created_at: '2026-06-04T09:00:00Z',
  updated_at: '2026-06-04T09:00:00Z',
  ...over,
})

beforeEach(() => apiFetch.mockReset())

describe('reservationsApi · listReservations mapping', () => {
  it('maps party_size/table_id/customer + ISO → epoch ms', async () => {
    apiFetch.mockResolvedValueOnce({ results: [row()] })
    const [r] = await listReservations()
    expect(r).toMatchObject({
      id: 'r1',
      customerId: 'c1',
      name: 'Mehta party',
      partySize: 4,
      tableId: 't3',
      status: 'booked',
      notes: 'window seat',
    })
    expect(r.at).toBe(Date.parse('2026-06-04T19:30:00Z'))
    expect(r.createdAt).toBe(Date.parse('2026-06-04T09:00:00Z'))
  })

  it('tolerates a walk-in with no customer/table and a bare array', async () => {
    apiFetch.mockResolvedValueOnce([row({ customer: null, table_id: null, phone: '' })])
    const [r] = await listReservations()
    expect(r.customerId).toBeNull()
    expect(r.tableId).toBeNull()
    expect(r.phone).toBe('')
  })

  it('returns [] for an empty page and requests ?limit=500', async () => {
    apiFetch.mockResolvedValueOnce({ results: [] })
    expect(await listReservations()).toEqual([])
    expect(apiFetch).toHaveBeenCalledWith('/crm/reservations/?limit=500')
  })
})
