// Unifies the video-usage panel's data source:
//  - demo mode    → a deterministic per-package mock (no backend)
//  - supabase mode → live video_screens rows via videoUsageRepo
// VideoUsagePanel consumes this hook and never needs to know which is active.

import { useEffect, useMemo, useState } from 'react'
import type { PackageId } from './billing'
import {
  demoVideoUsage,
  loadVideoUsage,
  type VideoUsage,
} from './videoUsageRepo'

export interface UseVideoUsage {
  loading: boolean
  usage: VideoUsage
  error: string | null
  source: 'demo' | 'supabase'
}

const EMPTY_USAGE: VideoUsage = { screens: [], activeCount: 0, totalBytes: 0 }

export function useVideoUsage(
  packageId: PackageId,
  restaurantId: string | null,
): UseVideoUsage {
  // Demo mode: synchronous, deterministic mock keyed on the package.
  const demo = useMemo(() => demoVideoUsage(packageId), [packageId])

  const [usage, setUsage] = useState<VideoUsage>(EMPTY_USAGE)
  const [loading, setLoading] = useState<boolean>(restaurantId !== null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (restaurantId === null) return
    let active = true
    setLoading(true)
    setError(null)
    loadVideoUsage(restaurantId)
      .then(u => {
        if (active) setUsage(u)
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
  }, [restaurantId])

  if (restaurantId === null) {
    return { loading: false, usage: demo, error: null, source: 'demo' }
  }

  return { loading, usage, error, source: 'supabase' }
}
