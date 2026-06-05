/**
 * Applies the signed-in restaurant's published theme/branding to the console.
 * Rendered inside AuthProvider so it can gate on auth + read the JWT. Renders
 * nothing — it just fetches `/theme/` once authed and pushes it into the
 * Theme/Brand contexts.
 */
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../console/auth/AuthContext'
import { getThemeConfig } from '../lib/api/themeConfig'
import { useApplyThemeConfig } from './useThemeConfig'
import { useBrand } from './BrandContext'

export function AppearanceLoader() {
  const auth = useAuth()
  const apply = useApplyThemeConfig()
  const { setBrand } = useBrand()

  const { data } = useQuery({
    queryKey: ['theme-config', auth.restaurantId],
    queryFn: getThemeConfig,
    enabled: auth.isAuthed,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (data) apply(data)
  }, [data, apply])

  // Use the org/display name as a logo fallback label.
  useEffect(() => {
    if (auth.displayName) setBrand({ displayName: auth.displayName })
  }, [auth.displayName, setBrand])

  return null
}
