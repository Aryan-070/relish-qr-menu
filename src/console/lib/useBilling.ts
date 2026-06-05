// Billing dashboard data source. The Supabase billing path was retired with the
// move to the Django backend; billing currently runs off the localStorage ops
// store (the dashboard remains a concept pending a Django billing wire-up).
// BillingView consumes this hook and never needs to know the source.

import { useEffect, useState } from 'react'
import { useOpsStore } from '../store/useOpsStore'
import type { BillingState, PackageId } from './billing'

export interface UseBilling {
  billing: BillingState | null
  loading: boolean
  error: string | null
  source: 'demo'
  /** Reserved for the future Django billing wire-up. */
  restaurantId: string | null
  setPackage: (id: PackageId) => Promise<void>
  renewNow: () => Promise<void>
  toggleAutoRenew: () => Promise<void>
}

export function useBilling(): UseBilling {
  const ops = useOpsStore()
  const [billing, setBilling] = useState<BillingState | null>(ops.state.billing)

  // Mirror the ops store so reducer updates flow straight through.
  useEffect(() => {
    setBilling(ops.state.billing)
  }, [ops.state.billing])

  const setPackage = async (id: PackageId) => {
    ops.billingSetPackage(id)
  }
  const renewNow = async () => {
    ops.billingRenewNow()
  }
  const toggleAutoRenew = async () => {
    ops.billingToggleAutoRenew()
  }

  return {
    billing,
    loading: false,
    error: null,
    source: 'demo',
    restaurantId: null,
    setPackage,
    renewNow,
    toggleAutoRenew,
  }
}
