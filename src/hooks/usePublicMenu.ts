/**
 * Loads the backend public menu for a restaurant and exposes a
 * ``code → backend item`` map so the QSR cart (which keys lines by the static
 * qsrMenu id == backend code) can resolve real ``MenuItem`` UUIDs at order time.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPublicMenu, type PublicMenuItem } from '../lib/api/publicMenu'

export interface UsePublicMenuResult {
  /** code → backend item (id/price/availability). Empty until loaded. */
  byCode: Map<string, PublicMenuItem>
  loading: boolean
  available: boolean
}

export function usePublicMenu(restaurantId: string | null | undefined): UsePublicMenuResult {
  const query = useQuery({
    queryKey: ['public-menu', restaurantId ?? null],
    queryFn: () => getPublicMenu(restaurantId as string),
    enabled: Boolean(restaurantId),
    staleTime: 60_000,
  })

  const byCode = useMemo(() => {
    const map = new Map<string, PublicMenuItem>()
    for (const category of query.data?.categories ?? []) {
      for (const item of category.items) map.set(item.code, item)
    }
    return map
  }, [query.data])

  return { byCode, loading: query.isLoading, available: query.data?.available ?? false }
}
