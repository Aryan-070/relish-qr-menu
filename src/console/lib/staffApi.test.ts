import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))
vi.mock('../../lib/api/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api/client')>()
  return { ...actual, apiFetch }
})

import { listStaff } from './staffApi'

beforeEach(() => apiFetch.mockReset())

describe('staffApi · listStaff mapping', () => {
  it('maps display_name → name and surfaces role/active', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: 'm1', display_name: 'Priya N', email: 'priya@t.test', role: 'waiter', status: 'active', active: true },
    ])
    const [s] = await listStaff()
    expect(s).toEqual({ id: 'm1', name: 'Priya N', email: 'priya@t.test', role: 'waiter', active: true })
  })

  it('falls back to email then "Staff" when display_name is blank', async () => {
    apiFetch.mockResolvedValueOnce([
      { id: 'm2', display_name: '', email: 'x@t.test', role: 'admin', status: 'active', active: true },
      { id: 'm3', display_name: '', email: '', role: 'manager', status: 'active', active: false },
    ])
    const [a, b] = await listStaff()
    expect(a.name).toBe('x@t.test')
    expect(b.name).toBe('Staff')
    expect(b.active).toBe(false)
  })

  it('hits the auth staff roster endpoint and tolerates a non-array body', async () => {
    apiFetch.mockResolvedValueOnce([])
    expect(await listStaff()).toEqual([])
    expect(apiFetch).toHaveBeenCalledWith('/auth/staff/')

    apiFetch.mockResolvedValueOnce(null as unknown as [])
    expect(await listStaff()).toEqual([])
  })
})
