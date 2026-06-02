// Pitch screenshot walker — drives the running dev server with Playwright
// (trusted events, so Framer-Motion cards click reliably) and captures every
// guest + console screen into assets/pitch/screens/.
//
// Usage: dev server on :5173, then `node scripts/pitch/capture.mjs`.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.PITCH_BASE || 'http://localhost:5173'
const OUT = 'assets/pitch/screens'
fs.mkdirSync(OUT, { recursive: true })

const log = (...a) => console.log('[capture]', ...a)
const done = []
const failed = []

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${OUT}/${name}.png` })
    done.push(name)
    log('✓', name)
  } catch (e) {
    failed.push(name)
    log('✗', name, e.message)
  }
}
const wait = (page, ms = 1200) => page.waitForTimeout(ms)

// Click the first visible element matching any of the given texts. Returns true on success.
async function tapText(page, texts, { exact = false, timeout = 2500 } = {}) {
  for (const t of texts) {
    try {
      const loc = page.getByText(t, { exact }).first()
      await loc.click({ timeout })
      return true
    } catch { /* try next */ }
  }
  return false
}

const browser = await chromium.launch()

// ─────────────────────────────────────────────────────────────────────────
// GUEST (mobile)
// ─────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  // Clean reseed (OPS_VERSION 6) + clear cart so screens show fresh demo data.
  await page.evaluate(() => { localStorage.removeItem('relish.ops.v1'); localStorage.removeItem('relish.cart.v1') })
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 2200)
  await shot(page, 'guest-landing-reel') // default

  // Other landing variants via the top-right switcher (buttons "1 Signature" … "7 Reel")
  const variants = [['2 Classic', 'classic'], ['3 Deco', 'gastronomique'], ['4 Editorial', 'editorial'], ['5 Botanica', 'botanica'], ['6 Cinema', 'cinematic'], ['1 Signature', 'signature']]
  for (const [label, slug] of variants) {
    if (await tapText(page, [label])) { await wait(page, 1900); await shot(page, `guest-landing-${slug}`) }
  }

  // Enter the menu from the current (Signature) landing
  await tapText(page, ['Open Menu', 'View Menu', 'Explore the menu', 'Browse menu'])
  await wait(page, 1600)
  await shot(page, 'guest-menu')

  // Category sweep
  for (const cat of ['Soups', 'Quick Bites', 'Italian Fiesta', 'Desserts', 'Beverages']) {
    if (await tapText(page, [cat])) { await wait(page, 1400); await shot(page, `guest-menu-${cat.toLowerCase().replace(/\s+/g, '-')}`); break }
  }

  // Item detail — tap a dish card (image card with a price)
  try {
    const card = page.locator('div', { hasText: /₹\d/ }).filter({ has: page.locator('img,video') }).first()
    await card.scrollIntoViewIfNeeded(); await card.click({ timeout: 3000 }); await wait(page, 1300)
    await shot(page, 'guest-item-detail')
    // Add to order
    if (await tapText(page, ['Add to Order'])) { await wait(page, 900) }
  } catch (e) { log('item detail skip', e.message) }

  // Search overlay
  try { await page.getByRole('button', { name: /search/i }).first().click({ timeout: 2000 }); await wait(page, 1000); await shot(page, 'guest-search') } catch {}

  // Recommendation flow
  if (await tapText(page, ['Ask AI', 'Recommend Something', 'Recommend'])) { await wait(page, 1500); await shot(page, 'guest-recommend') }

  // Order panel (cart) — tap the Order nav / island
  if (await tapText(page, ['My Order', 'Order'])) { await wait(page, 1200); await shot(page, 'guest-order-panel') }

  // Checkout (pay-at-table)
  if (await tapText(page, ['Pay bill'])) { await wait(page, 1300); await shot(page, 'guest-checkout') }

  // Service panel + sub-views
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1500)
  await tapText(page, ['Open Menu', 'View Menu'])
  await wait(page, 1200)
  if (await tapText(page, ['Call Waiter', 'Waiter'])) {
    await wait(page, 1200); await shot(page, 'guest-service-home')
    if (await tapText(page, ['Water'])) { await wait(page, 900); await shot(page, 'guest-service-water'); await tapText(page, ['Back', 'Done']) }
    if (await tapText(page, ['Bill'])) { await wait(page, 900); await shot(page, 'guest-service-bill'); await tapText(page, ['Back', 'Done']) }
    if (await tapText(page, ['Rate us', 'Rate your visit', 'More'])) { await wait(page, 700); await tapText(page, ['Rate us', 'Rate your visit']); await wait(page, 800); await shot(page, 'guest-feedback') }
  }

  // Kiosk
  const kiosk = await ctx.newPage()
  await kiosk.setViewportSize({ width: 1280, height: 900 })
  await kiosk.goto(`${BASE}/?kiosk=1`, { waitUntil: 'networkidle' }); await wait(kiosk, 2200)
  await shot(kiosk, 'guest-kiosk')

  await ctx.close()
}

// ─────────────────────────────────────────────────────────────────────────
// STAFF CONSOLE (desktop) — for each role, click every sidebar nav item
// ─────────────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/#staff`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.removeItem('relish.ops.v1'); localStorage.removeItem('relish.cart.v1') })
  await page.goto(`${BASE}/#staff`, { waitUntil: 'networkidle' }); await wait(page, 2200)

  for (const role of ['Admin', 'Manager', 'Waiter']) {
    // Switch role via the demo SegmentedControl in the top bar
    await tapText(page, [role], { exact: true })
    await wait(page, 1400)
    await shot(page, `console-${role.toLowerCase()}-default`)

    // Read sidebar nav labels, then click each and shoot. Sidebar = <nav> region.
    let labels = []
    try {
      labels = await page.locator('nav button, aside button, [data-nav] button').allInnerTexts()
    } catch {}
    // Fallback: known label set
    if (!labels.length) {
      labels = ['Dashboard', 'Reports', 'Records', 'Menu', 'Staff', 'Staff Admin', 'Roster', 'Group', 'Inventory', 'Reservations', 'Loyalty', 'Feedback', 'Campaigns', 'Promotions', 'QR Codes', 'Cash & Loss', 'Billing', 'Floor', 'Kitchen', 'My Tables', 'Service Queue']
    }
    const seen = new Set()
    for (const raw of labels) {
      const label = raw.trim().split('\n')[0].trim()
      if (!label || seen.has(label) || label.length > 20) continue
      seen.add(label)
      try {
        await page.getByRole('button', { name: label, exact: true }).first().click({ timeout: 2000 })
        await wait(page, 1400)
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await shot(page, `console-${role.toLowerCase()}-${slug}`)
      } catch (e) { /* not a nav item / not clickable */ }
    }
  }
  await ctx.close()
}

await browser.close()
log(`\nDONE: ${done.length} shots, ${failed.length} failed`)
fs.writeFileSync(`${OUT}/_manifest.json`, JSON.stringify({ done, failed }, null, 2))
