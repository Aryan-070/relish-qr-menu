import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock apiFetch but keep the real ApiError so isConflict() narrows correctly.
const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('../../lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>()
  return { ...actual, apiFetch }
})

import { ApiError } from '../../lib/api/client'
import {
  listTables,
  createTable,
  seatTable,
  clearTable,
  setTableStatus,
  assignWaiter,
  isConflict,
} from './floorApi'

const row = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  code: 'T1',
  label: 'Table 1',
  seats: 4,
  zone: 'Garden',
  status: 'available',
  waiter_membership: null,
  guests: 0,
  seated_at: null,
  version: 1,
  ...over,
})

beforeEach(() => apiFetch.mockReset())

describe('floorApi · listTables mapping', () => {
  it('maps snake_case → camelCase and ISO seated_at → epoch ms', async () => {
    const iso = '2026-06-04T10:30:00Z'
    apiFetch.mockResolvedValueOnce({
      results: [row({ waiter_membership: 'm9', seated_at: iso, guests: 3, version: 7 })],
    })
    const [t] = await listTables()
    expect(t).toMatchObject({
      id: 't1',
      code: 'T1',
      label: 'Table 1',
      zone: 'Garden',
      status: 'available',
      waiterMembershipId: 'm9',
      guests: 3,
      version: 7,
    })
    expect(t.seatedAt).toBe(Date.parse(iso))
  })

  it('keeps seatedAt null when the table is empty', async () => {
    apiFetch.mockResolvedValueOnce({ results: [row()] })
    const [t] = await listTables()
    expect(t.seatedAt).toBeNull()
    expect(t.waiterMembershipId).toBeNull()
  })

  it('normalizes a bare array response (no pagination envelope)', async () => {
    apiFetch.mockResolvedValueOnce([row(), row({ id: 't2' })])
    expect(await listTables()).toHaveLength(2)
  })

  it('returns [] for an empty page', async () => {
    apiFetch.mockResolvedValueOnce({ results: [] })
    expect(await listTables()).toEqual([])
  })

  it('requests the whole floor in one page (?limit=500)', async () => {
    apiFetch.mockResolvedValueOnce({ results: [] })
    await listTables()
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/?limit=500')
  })
})

describe('floorApi · CRUD request bodies', () => {
  it('createTable stamps status=available + guests=0', async () => {
    apiFetch.mockResolvedValueOnce(row({ code: 'T7', label: 'Table 7', seats: 2 }))
    await createTable({ code: 'T7', label: 'Table 7', seats: 2, zone: 'Patio' })
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/', {
      method: 'POST',
      body: { code: 'T7', label: 'Table 7', seats: 2, zone: 'Patio', status: 'available', guests: 0 },
    })
  })

  it('seatTable sends guests + version, and omits waiter when not given', async () => {
    apiFetch.mockResolvedValueOnce(row({ status: 'seated', guests: 2, version: 2 }))
    await seatTable('t1', 1, 2)
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/t1/seat/', { method: 'POST', body: { guests: 2, version: 1 } })
  })

  it('seatTable includes waiter_membership_id only when provided', async () => {
    apiFetch.mockResolvedValueOnce(row({ status: 'seated' }))
    await seatTable('t1', 1, 2, 'm5')
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/t1/seat/', {
      method: 'POST',
      body: { guests: 2, version: 1, waiter_membership_id: 'm5' },
    })
  })

  it('clearTable and setTableStatus carry the version', async () => {
    apiFetch.mockResolvedValueOnce(row())
    await clearTable('t1', 3)
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/t1/clear/', { method: 'POST', body: { version: 3 } })

    apiFetch.mockResolvedValueOnce(row({ status: 'ordering' }))
    await setTableStatus('t1', 3, 'ordering')
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/t1/set_status/', { method: 'POST', body: { status: 'ordering', version: 3 } })
  })

  it('assignWaiter PATCHes waiter_membership + version (null clears)', async () => {
    apiFetch.mockResolvedValueOnce(row())
    await assignWaiter('t1', 2, null)
    expect(apiFetch).toHaveBeenCalledWith('/ops/tables/t1/', { method: 'PATCH', body: { waiter_membership: null, version: 2 } })
  })
})

describe('floorApi · isConflict', () => {
  it('is true only for an HTTP 409 ApiError', () => {
    expect(isConflict(new ApiError(409, {}, 'stale'))).toBe(true)
    expect(isConflict(new ApiError(400, {}, 'bad'))).toBe(false)
    expect(isConflict(new Error('network'))).toBe(false)
    expect(isConflict(null)).toBe(false)
  })
})
