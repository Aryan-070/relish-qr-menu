// Auth foundation for the Staff Console (Phase 6.1).
// - 'supabase' mode (env configured): real Supabase Auth, session-gated console.
// - 'demo' mode (no env): no login, the existing localStorage demo runs as-is.
// This keeps the static demo deployable while wiring real auth behind a flag.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { ensureTenant } from '../lib/provisionTenant'
import type { Role } from '../lib/types'

export type AuthMode = 'demo' | 'supabase'
export type AuthStatus = 'loading' | 'ready'

export interface AuthValue {
  mode: AuthMode
  status: AuthStatus
  user: User | null
  appRole: Role | null
  /** The signed-in user's restaurant (supabase mode). Null in demo mode or
   *  before provisioning completes. The ops store keys all sync on this. */
  restaurantId: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isSupabaseConfigured ? 'supabase' : 'demo'
  const [status, setStatus] = useState<AuthStatus>(mode === 'supabase' ? 'loading' : 'ready')
  const [user, setUser] = useState<User | null>(null)
  const [appRole, setAppRole] = useState<Role | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setStatus('ready')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(session?.user ?? null)
      setStatus('ready')
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Provision the tenant on first sign-in, then drive the console role +
  // restaurantId from the user's app_users row (supabase mode). ensureTenant is
  // idempotent: it creates a restaurant + admin membership + seeds demo data only
  // when no membership exists yet, otherwise it's a no-op read. Demo mode has no
  // client, so appRole/restaurantId stay null and the demo switcher governs role.
  useEffect(() => {
    if (!supabase) return
    if (!user) {
      setAppRole(null)
      setRestaurantId(null)
      return
    }
    let active = true
    void (async () => {
      try {
        await ensureTenant({ id: user.id, email: user.email })
      } catch {
        /* provisioning failed — fall through; membership read below stays null */
      }
      if (!active || !supabase) return
      const { data } = await supabase
        .from('app_users')
        .select('role, restaurant_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      setAppRole((data?.role as Role | undefined) ?? null)
      setRestaurantId((data?.restaurant_id as string | undefined) ?? null)
    })()
    return () => {
      active = false
    }
  }, [user])

  const value = useMemo<AuthValue>(
    () => ({
      mode,
      status,
      user,
      appRole,
      restaurantId,
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Auth is not configured.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signUp: async (email, password) => {
        if (!supabase) return { error: 'Auth is not configured.' }
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error?.message ?? null }
      },
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
        setUser(null)
        setAppRole(null)
        setRestaurantId(null)
      },
    }),
    [mode, status, user, appRole, restaurantId],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
