// Video-egress metering data layer for the Billing dashboard (Phase 6.4).
//
// Reads the public.video_screens table (one row per on-menu video surface) and
// rolls it up into a small VideoUsage summary: how many screens are live and
// how many bytes they've served this billing cycle. When Supabase is not
// configured the panel falls back to a deterministic per-package mock so the
// surface still renders in the localStorage demo.
//
// Domain types live here; formatBytes is a local display helper kept out of
// the shared format.ts (which is ₹-only) so we don't widen that module.

import { supabase } from '../../lib/supabase'
import type { PackageId } from './billing'

export interface VideoScreen {
  id: string
  label: string
  active: boolean
  bytesServed: number
}

export interface VideoUsage {
  screens: VideoScreen[]
  activeCount: number
  totalBytes: number
}

// ── DB row shape ─────────────────────────────────────────────────────────────
// Snake-case as returned by supabase-js. bytes_served is a bigint, which the
// client may surface as a JS number or a string depending on magnitude — we
// always coerce with Number() before it leaves this module.
interface VideoScreenRow {
  id: string
  label: string
  active: boolean
  bytes_served: number | string
}

const KB = 1_000
const MB = 1_000_000
const GB = 1_000_000_000

/** Human-readable byte size: '0 MB', '512 KB', '4 MB', '1.2 GB'. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 MB'
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`
  if (n >= MB) return `${Math.round(n / MB)} MB`
  if (n >= KB) return `${Math.round(n / KB)} KB`
  return `${Math.round(n)} B`
}

function rowToScreen(row: VideoScreenRow): VideoScreen {
  return {
    id: row.id,
    label: row.label,
    active: row.active === true,
    bytesServed: Number(row.bytes_served),
  }
}

/** Roll a screen list up into the summary, counting active screens only. */
function summarise(screens: VideoScreen[]): VideoUsage {
  const active = screens.filter(s => s.active)
  return {
    screens,
    activeCount: active.length,
    totalBytes: active.reduce((sum, s) => sum + s.bytesServed, 0),
  }
}

// ── loadVideoUsage ───────────────────────────────────────────────────────────
/** Read every video screen for a restaurant and summarise active egress. */
export async function loadVideoUsage(restaurantId: string): Promise<VideoUsage> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data, error } = await supabase
    .from('video_screens')
    .select('id,label,active,bytes_served')
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(error.message)

  const screens = ((data ?? []) as VideoScreenRow[]).map(rowToScreen)
  return summarise(screens)
}

// ── demoVideoUsage ───────────────────────────────────────────────────────────
// Deterministic mock (no randomness) for demo mode. Screen count scales with
// the package's video tier; web-menu / classic have no on-menu video.
const SCREEN_COUNT: Record<PackageId, number> = {
  'web-menu': 0,
  classic: 0,
  cinematic: 6,
  signature: 9,
}

const SCREEN_LABELS = [
  'Hero',
  'Beverages',
  'Soups',
  'Quick Bites',
  'Italian',
  'Desserts',
  'Waiter',
  'Water',
  'Bread',
]

/** Deterministic per-package usage mock for the localStorage demo. */
export function demoVideoUsage(packageId: PackageId): VideoUsage {
  const count = SCREEN_COUNT[packageId]
  const screens: VideoScreen[] = SCREEN_LABELS.slice(0, count).map((label, i) => ({
    id: `demo-${packageId}-${i}`,
    label,
    active: true,
    // Ramp from a few hundred MB up to ~2 GB so the rolled-up total reads as a
    // believable few-GB cycle. Rounded to whole bytes.
    bytesServed: Math.round(((i + 1) * 1_200_000_000) / 6),
  }))
  return summarise(screens)
}
