// Vercel Node serverless function — creates a Razorpay order.
//
// NOTE: Files under `api/` are deploy-only and are NOT part of the app's `tsc`
// build (see tsconfig include globs), so it's acceptable to type `req`/`res` as
// `any` here rather than pulling in `@vercel/node` types as a dependency. This
// keeps the repo free of a Razorpay/Vercel npm install — we use global `fetch`
// and Node's built-in `Buffer` only.
//
// Env (set in Vercel → Project Settings → Environment Variables):
//   RAZORPAY_KEY_ID     — Razorpay key id (server copy)
//   RAZORPAY_KEY_SECRET — Razorpay key secret (NEVER exposed to the client)

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    res.status(501).json({ error: 'Razorpay not configured' })
    return
  }

  const { amountPaise, invoiceId } = req.body ?? {}

  if (typeof amountPaise !== 'number' || amountPaise <= 0) {
    res.status(400).json({ error: 'amountPaise must be a positive number' })
    return
  }

  if (typeof invoiceId !== 'string' || invoiceId.length === 0) {
    res.status(400).json({ error: 'invoiceId is required' })
    return
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  try {
    const rzpResponse = await fetch(RAZORPAY_ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: invoiceId,
      }),
    })

    if (!rzpResponse.ok) {
      const detail = await rzpResponse.text()
      res
        .status(502)
        .json({ error: 'Razorpay order creation failed', detail })
      return
    }

    const order = await rzpResponse.json()
    res.status(200).json({ orderId: order.id })
  } catch (error) {
    res.status(502).json({
      error: 'Razorpay request failed',
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}
