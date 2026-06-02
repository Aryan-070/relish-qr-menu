// Vercel Node serverless function — video-egress metering ingestion (Phase 6.4).
//
// A CDN worker / cron POSTs here to record bytes served for a single video
// screen. Body: { restaurantId, screenId, bytes }. We increment the matching
// `video_screens.bytes_served` counter.
//
// NOTE: Files under `api/` are deploy-only and NOT part of the app's `tsc`
// build, so `req`/`res` are typed `any` here rather than installing
// `@vercel/node`.
//
// Env (set in Vercel → Project Settings → Environment Variables):
//   SUPABASE_URL              — project URL
//   SUPABASE_SERVICE_ROLE_KEY — service-role key (NEVER exposed to the client)
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(501).json({ error: 'Supabase not configured' })
    return
  }

  const { restaurantId, screenId, bytes } = req.body ?? {}

  if (typeof restaurantId !== 'string' || restaurantId.length === 0) {
    res.status(400).json({ error: 'restaurantId is required' })
    return
  }

  if (typeof screenId !== 'string' || screenId.length === 0) {
    res.status(400).json({ error: 'screenId is required' })
    return
  }

  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    res.status(400).json({ error: 'bytes must be a non-negative number' })
    return
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  try {
    // Read-then-write increment. NOTE: this is NOT atomic — concurrent calls
    // for the same screen can lose updates. Acceptable for this scaffold;
    // production should use a Postgres RPC (e.g. `increment_bytes_served`)
    // so the add happens server-side in a single statement.
    const { data: current, error: readError } = await admin
      .from('video_screens')
      .select('bytes_served')
      .eq('id', screenId)
      .eq('restaurant_id', restaurantId)
      .single()

    if (readError) {
      res.status(404).json({ error: 'Video screen not found' })
      return
    }

    const bytesServed = (current?.bytes_served ?? 0) + bytes

    const { error: writeError } = await admin
      .from('video_screens')
      .update({ bytes_served: bytesServed })
      .eq('id', screenId)
      .eq('restaurant_id', restaurantId)

    if (writeError) {
      res.status(502).json({
        error: 'Failed to update bytes_served',
        detail: writeError.message,
      })
      return
    }

    res.status(200).json({ ok: true, bytesServed })
  } catch (error) {
    res.status(502).json({
      error: 'Usage tracking request failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
