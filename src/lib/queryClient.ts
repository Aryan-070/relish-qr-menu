import { QueryClient } from '@tanstack/react-query'

/**
 * Shared React Query client for the app. Conservative defaults: no refetch on
 * window focus (a restaurant tablet/phone toggles constantly), one retry, and a
 * short stale time — per-query `refetchInterval` drives live polling where it's
 * wanted (e.g. the dining session snapshot).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 2000,
    },
  },
})
