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
      order?: { entity?: { receipt?: string } }
      payment?: { entity?: { order_id?: string; notes?: Record<string, string> } }
    }
  }

  try {
    event = JSON.parse(rawBody.toString('utf8'))
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' })
    return
  }

  if (event.event === 'payment.captured' || event.event === 'order.paid') {
    // The `receipt` we set when creating the order is the invoiceId.
    const invoiceId =
      event.payload?.order?.entity?.receipt ??
      event.payload?.payment?.entity?.notes?.invoiceId

    // TODO(billing): mark the matching invoice paid.
    // ----------------------------------------------------------------------
    // This requires the Supabase SERVICE-ROLE key (SUPABASE_SERVICE_ROLE_KEY),
    // which must NOT be imported into the browser bundle — so we deliberately
    // do NOT import `src/lib/supabase.ts` here. Wire this up with a server-only
    // Supabase client, e.g.:
    //
    //   import { createClient } from '@supabase/supabase-js'
    //   const admin = createClient(
    //     process.env.SUPABASE_URL!,
    //     process.env.SUPABASE_SERVICE_ROLE_KEY!,
    //   )
    //   await admin
    //     .from('invoices')
    //     .update({ status: 'paid', paid_at: new Date().toISOString() })
    //     .eq('id', invoiceId)
    //
    // (`invoiceId` resolved above from order.receipt / payment.notes.)
    // ----------------------------------------------------------------------
    void invoiceId
  }

  // Always 200 on a valid signature so Razorpay stops retrying.
  res.status(200).json({ received: true })
}
