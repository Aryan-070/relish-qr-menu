// Unifies the Billing dashboard's data source:
//  - demo mode    → the synchronous localStorage ops store (unchanged behaviour)
//  - supabase mode → real subscription + invoice rows via billingRepo
// BillingView consumes this hook and never needs to know which is active.

import { useCallback, useEffect, useState } from 'react'
import { useOpsStore } from '../store/useOpsStore'
import { useAuth } from '../auth/AuthContext'
import type { BillingState, PackageId } from './billing'
import {
  ensureBillingForUser,
  loadBilling,
  setPackageRemote,
  renewNowRemote,
  toggleAutoRenewRemote,
} from './billingRepo'

export interface UseBilling {
  billing: BillingState | null
  loading: boolean
  error: string | null
  source: 'demo' | 'supabase'
  /** Supabase restaurant id, or null in demo mode. */
  restaurantId: string | null
  setPackage: (id: PackageId) => Promise<void>
  renewNow: () => Promise<void>
  toggleAutoRenew: () => Promise<void>
}

export function useBilling(): UseBilling {
  const ops = useOpsStore()
  const auth = useAuth()
  const supa = auth.mode === 'supabase'

  const [billing, setBilling] = useState<BillingState | null>(supa ? null : ops.state.billing)
  const [loading, setLoading] = useState<boolean>(supa)
  const [error, setError] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  // Demo: mirror the ops store so reducer updates flow straight through.
  useEffect(() => {
    if (!supa) setBilling(ops.state.billing)
  }, [supa, ops.state.billing])

  const refresh = useCallback(async (rid: string) => {
    setBilling(await loadBilling(rid))
  }, [])

  // Supabase: bootstrap the restaurant on first sign-in, then load.
  useEffect(() => {
    if (!supa || !auth.user) return
    let active = true
    setLoading(true)
    setError(null)
    ensureBillingForUser(auth.user.id)
      .then(async rid => {
        if (!active) return
        setRestaurantId(rid)
        await refresh(rid)
      })
      .catch(e => {
        if (active) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [supa, auth.user, refresh])

  const setPackage = useCallback(
    async (id: PackageId) => {
      if (!supa) {
        ops.billingSetPackage(id)
        return
      }
      if (!restaurantId) return
      await setPackageRemote(restaurantId, id)
      await refresh(restaurantId)
    },
    [supa, ops, restaurantId, refresh],
  )

  const renewNow = useCallback(async () => {
    if (!supa) {
      ops.billingRenewNow()
      return
    }
    if (!restaurantId) return
    await renewNowRemote(restaurantId)
    await refresh(restaurantId)
  }, [supa, ops, restaurantId, refresh])

  const toggleAutoRenew = useCallback(async () => {
    if (!supa) {
      ops.billingToggleAutoRenew()
      return
    }
    if (!restaurantId) return
    await toggleAutoRenewRemote(restaurantId)
    await refresh(restaurantId)
  }, [supa, ops, restaurantId, refresh])

  return { billing, loading, error, source: supa ? 'supabase' : 'demo', restaurantId, setPackage, renewNow, toggleAutoRenew }
}
