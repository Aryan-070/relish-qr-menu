// Vercel Node serverless function — notification send stub (demo).
//
// Mirrors the style of api/usage/track.ts. Dependency-free: this is a keyless
// demo endpoint that always acknowledges a POST with { ok: true } so the sales
// demo's outreach flow has a backend to point at. Real channel delivery
// (WhatsApp/SMS/email) would be wired here later behind env-gated providers.
//
// NOTE: Files under `api/` are deploy-only and NOT part of the app's `tsc`
// build, so `req`/`res` are typed `any` here rather than installing
// `@vercel/node`.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  res.status(200).json({ ok: true })
}
