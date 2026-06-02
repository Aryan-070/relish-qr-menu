// Realtime subscription hook for the Staff Console (Phase 0 ops spine).
//
// Subscribes to Postgres change events on the live-ops tables (added to the
// supabase_realtime publication in 0002_ops.sql) and fans each INSERT / UPDATE /
// DELETE out to a per-table handler. When Supabase is not configured the hook is
// a no-op, so the localStorage demo keeps working untouched.
//
// Uses the @supabase/supabase-js v2 channel API:
//   supabase.channel(name).on('postgres_changes', { event, schema, table }, cb)

import { useEffect } from 'react'
import type {
  RealtimePostgresChangesPayload,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
} from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

/** The live-ops tables we listen to. Matches the 0002_ops.sql publication. */
export type RealtimeTable =
  | 'orders'
  | 'order_lines'
  | 'restaurant_tables'
  | 'service_requests'
  | 'menu_items'

/**
 * Per-event callbacks for one table. A `Record<string, unknown>` row is passed
 * through as-is; callers cast to their own row shape. Any handler may be
 * omitted — only the supplied ones fire.
 */
export interface RealtimeTableHandlers {
  onInsert?: (row: Record<string, unknown>) => void
  onUpdate?: (row: Record<string, unknown>, old: Record<string, unknown>) => void
  onDelete?: (old: Record<string, unknown>) => void
}

/** Map of table -> its handlers. Tables omitted here are not subscribed. */
export type RealtimeOpsHandlers = Partial<Record<RealtimeTable, RealtimeTableHandlers>>

const TABLES: RealtimeTable[] = [
  'orders',
  'order_lines',
  'restaurant_tables',
  'service_requests',
  'menu_items',
]

/** Narrow a payload's `new` field to a row record (empty on DELETE). */
function newRow(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Record<string, unknown> {
  const n = (payload as RealtimePostgresInsertPayload<Record<string, unknown>>).new
  return (n ?? {}) as Record<string, unknown>
}

/** Narrow a payload's `old` field to a row record (may be partial on UPDATE/DELETE). */
function oldRow(
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Record<string, unknown> {
  const o = (payload as RealtimePostgresUpdatePayload<Record<string, unknown>>).old
  return (o ?? {}) as Record<string, unknown>
}

/**
 * Subscribe to realtime ops changes for one restaurant.
 *
 * @param restaurantId  the restaurant to scope the row filter to. When falsy
 *                      (e.g. not yet loaded) no subscription is created.
 * @param handlers      per-table INSERT/UPDATE/DELETE callbacks. Reference
 *                      stability matters: pass a memoised object (useMemo /
 *                      useCallback) or the channel will be torn down and rebuilt
 *                      on every render.
 */
export function useRealtimeOps(
  restaurantId: string | null | undefined,
  handlers: RealtimeOpsHandlers,
): void {
  useEffect(() => {
    // Demo mode (no Supabase) or no restaurant yet: nothing to subscribe to.
    if (!isSupabaseConfigured || !supabase || !restaurantId) return

    const db = supabase
    const channel = db.channel(`ops:${restaurantId}`)

    for (const table of TABLES) {
      const tableHandlers = handlers[table]
      if (!tableHandlers) continue

      channel.on<Record<string, unknown>>(
        // event: '*' selects the typed ALL overload, whose callback receives a
        // RealtimePostgresChangesPayload<T>. The row filter scopes events to
        // this restaurant so we never react to another tenant's changes.
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          switch (payload.eventType) {
            case 'INSERT':
              tableHandlers.onInsert?.(newRow(payload))
              break
            case 'UPDATE':
              tableHandlers.onUpdate?.(newRow(payload), oldRow(payload))
              break
            case 'DELETE':
              tableHandlers.onDelete?.(oldRow(payload))
              break
            default:
              break
          }
        },
      )
    }

    channel.subscribe()

    // Tear the channel down on unmount / dependency change so we don't leak
    // sockets or double-fire after a restaurant switch.
    return () => {
      void db.removeChannel(channel)
    }
  }, [restaurantId, handlers])
}

// Re-export the narrow payload types so consumers can annotate their handlers
// without importing from '@supabase/supabase-js' directly.
export type {
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  RealtimePostgresDeletePayload,
}
