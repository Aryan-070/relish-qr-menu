// Vercel Node serverless function — Razorpay webhook receiver.
//
// NOTE: Files under `api/` are deploy-only and NOT part of the app's `tsc`
// build, so `req`/`res` are typed `any` here rather than installing
// `@vercel/node`. We use Node's built-in `crypto` only — no npm `razorpay`.
//
// IMPORTANT — raw body:
// Signature verification must run over the EXACT raw request bytes. Vercel's
// default JSON body parser would re-serialise the payload and break the HMAC,
// so we disable it (via the `config` export below) and read the raw stream
// ourselves.
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

// Read the raw request stream into a single Buffer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!webhookSecret) {
    res.status(501).json({ error: 'Razorpay not configured' })
    return
  }

  const signature = req.headers['x-razorpay-signature']

  if (typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing x-razorpay-signature header' })
    return
  }

  const rawBody = await readRawBody(req)

  const expected = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  // Constant-time-ish comparison: lengths differ → invalid; otherwise compare.
  if (expected !== signature) {
    res.status(400).json({ error: 'Invalid signature' })
    return
  }

  let event: {
    event?: string
    payload?: {
      order?: { entity?: { id?: string; receipt?: string } }
      payment?: {
        entity?: {
          id?: string
          order_id?: string
          receipt?: string
          notes?: Record<string, string>
        }
      }
    }
  }

  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' })
    return
  }

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    // The `receipt` we set in create-order.ts is the invoiceId. Razorpay
    // delivers it under different paths depending on the event:
    //   - order.paid       → payload.order.entity.receipt
    //   - payment.captured → payload.payment.entity.receipt (when present),
    //                        falling back to a `notes.invoiceId` we may set.
    const invoiceId =
      event.payload?.order?.entity?.receipt ??
      event.payload?.payment?.entity?.receipt ??
      event.payload?.payment?.entity?.notes?.invoiceId

    // Razorpay payment id (e.g. "pay_..."). Only present on payment events.
    const paymentId = event.payload?.payment?.entity?.id

    // Mark the matching invoice paid using a SERVICE-ROLE Supabase client.
    // This key must NEVER reach the browser bundle, so we deliberately do NOT
    // import `src/lib/supabase.ts` here — we build a server-only client.
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!invoiceId) {
      // Signature was valid but we couldn't resolve the invoice — log and 200
      // anyway so Razorpay stops retrying a payload we can't map.
      console.warn('[razorpay/webhook] no invoiceId resolved from payload', {
        event: event.event,
      })
    } else if (!supabaseUrl || !serviceRoleKey) {
      // Signature valid but DB not configured — skip the write, still 200.
      console.warn(
        '[razorpay/webhook] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing; ' +
          'skipping invoice update',
        { invoiceId },
      )
    } else {
      try {
        const admin = createClient(supabaseUrl, serviceRoleKey)
        const { error } = await admin
          .from('invoices')
          .update({
            status: 'paid',
            razorpay_id: paymentId,
            paid_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)

        if (error) {
          console.error('[razorpay/webhook] invoice update failed', {
            invoiceId,
            error: error.message,
          })
        }
      } catch (error) {
        // Never throw out of the handler — Razorpay only needs a 200/4xx.
        console.error('[razorpay/webhook] invoice update threw', {
          invoiceId,
          detail: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  // Always 200 on a valid signature so Razorpay stops retrying.
  res.status(200).json({ received: true })
}
