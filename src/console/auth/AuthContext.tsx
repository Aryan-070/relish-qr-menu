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

export type AuthMode = 'demo' | 'supabase'
export type AuthStatus = 'loading' | 'ready'

export interface AuthValue {
  mode: AuthMode
  status: AuthStatus
  user: User | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isSupabaseConfigured ? 'supabase' : 'demo'
  const [status, setStatus] = useState<AuthStatus>(mode === 'supabase' ? 'loading' : 'ready')
  const [user, setUser] = useState<User | null>(null)

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

  const value = useMemo<AuthValue>(
    () => ({
      mode,
      status,
      user,
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
      },
    }),
    [mode, status, user],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
