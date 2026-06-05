/**
 * Fetch the live consumer menu for a restaurant from the backend public API and
 * adapt it into the static `Category[]` shape the consumer UI expects. Powers
 * the root storefront so console price edits reach guests.
 */
import { useQuery } from '@tanstack/react-query'
import { getPublicMenu } from '../lib/api/publicMenu'
import { adaptPublicMenu } from '../lib/api/menuAdapter'
import type { Category } from '../data/menu'
import type { ThemeConfig } from '../lib/api/themeConfig'

export interface ConsumerMenu {
  categories: Category[]
  theme: ThemeConfig | null
  available: boolean
  isLoading: boolean
  isError: boolean
}

export function useConsumerMenu(restaurantId: string | null): ConsumerMenu {
  const query = useQuery({
    queryKey: ['consumer-menu', restaurantId],
    queryFn: () => getPublicMenu(restaurantId as string),
    enabled: !!restaurantId,
    staleTime: 60_000,
  })

  return {
    categories: query.data ? adaptPublicMenu(query.data) : [],
    theme: query.data?.theme ?? null,
    available: query.data?.available ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
