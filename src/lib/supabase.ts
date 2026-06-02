// Supabase client — created only when both env vars are present.
// When they're absent the whole app runs as a localStorage demo, so it still
// builds, deploys to Vercel, and works with no backend. Add the two
// VITE_SUPABASE_* vars (see .env.example) to switch real auth + data on.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both Supabase env vars are set. */
export const isSupabaseConfigured = Boolean(url && anonKey)

/** The Supabase client, or null when running in demo mode. */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
