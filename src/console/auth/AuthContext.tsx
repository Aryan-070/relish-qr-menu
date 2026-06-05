// Auth for the Staff Console — backed by the Django/DRF backend.
//
// The console is always login-gated: there is no unauthenticated path. On mount
// we hydrate the signed-in identity from `/auth/me/` (using a stored JWT); a
// successful `signIn` exchanges username/email + password for a token. Role,
// restaurant and permissions come from the user's *active* membership.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ApiError, getStaffToken } from '../../lib/api/client'
import { getMe, isStaffAuthed, staffLogin, staffLogout } from '../../lib/api/auth'
import type { Permission, Role } from '../lib/types'

export type AuthStatus = 'loading' | 'ready'

export interface AuthValue {
  status: AuthStatus
  isAuthed: boolean
  /** Active-membership role, normalised to a console role (kitchen/host → waiter). */
  appRole: Role | null
  restaurantId: string | null
  membershipId: string | null
  displayName: string | null
  username: string | null
  email: string | null
  permissions: Permission[]
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>
  signOut: () => void
}

const Ctx = createContext<AuthValue | null>(null)

/** Map a backend role key onto the three console roles (least privilege fallback). */
function toConsoleRole(role: string | null | undefined): Role | null {
  if (role === 'admin' || role === 'manager' || role === 'waiter') return role
  if (role === 'kitchen' || role === 'host') return 'waiter'
  return role ? 'waiter' : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    isStaffAuthed() ? 'loading' : 'ready',
  )
  const [isAuthed, setIsAuthed] = useState(false)
  const [appRole, setAppRole] = useState<Role | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [membershipId, setMembershipId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])

  const resetIdentity = () => {
    setIsAuthed(false)
    setAppRole(null)
    setRestaurantId(null)
    setMembershipId(null)
    setDisplayName(null)
    setUsername(null)
    setEmail(null)
    setPermissions([])
  }

  const hydrate = async (): Promise<void> => {
    try {
      const me = await getMe()
      const active = me.active
      setIsAuthed(true)
      setUsername(me.username)
      setEmail(me.email)
      setDisplayName(active?.org_name ?? me.username)
      setAppRole(toConsoleRole(active?.role))
      setRestaurantId(active?.restaurant_id ?? null)
      setMembershipId(active?.membership_id ?? null)
      setPermissions((active?.perms as Permission[] | undefined) ?? [])
    } catch (err) {
      // 401 (or any failure) → token is stale/absent; drop it and stay signed out.
      if (err instanceof ApiError && err.status === 401) staffLogout()
      resetIdentity()
    } finally {
      setStatus('ready')
    }
  }

  // On mount, hydrate from a stored token if one exists.
  useEffect(() => {
    if (!getStaffToken()) {
      setStatus('ready')
      return
    }
    void hydrate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      isAuthed,
      appRole,
      restaurantId,
      membershipId,
      displayName,
      username,
      email,
      permissions,
      signIn: async (identifier, password) => {
        try {
          await staffLogin(identifier, password)
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.status === 401
                ? 'Incorrect username or password.'
                : (err.body?.detail ?? 'Sign-in failed.')
              : 'Network error — please try again.'
          return { error: message }
        }
        setStatus('loading')
        await hydrate()
        return { error: null }
      },
      signOut: () => {
        staffLogout()
        resetIdentity()
        setStatus('ready')
      },
    }),
    [status, isAuthed, appRole, restaurantId, membershipId, displayName, username, email, permissions],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
