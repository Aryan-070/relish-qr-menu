// Targeted second pass — the money-loop guest screens + manager/waiter console
// sub-views the first sweep missed.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.PITCH_BASE || 'http://localhost:5173'
const OUT = 'assets/pitch/screens'
fs.mkdirSync(OUT, { recursive: true })
const log = (...a) => console.log('[capture2]', ...a)
const wait = (p, ms = 1300) => p.waitForTimeout(ms)
async function shot(p, n) { try { await p.screenshot({ path: `${OUT}/${n}.png` }); log('✓', n) } catch (e) { log('✗', n, e.message) } }
async function tap(p, texts, { exact = false, timeout = 2500 } = {}) {
  for (const t of texts) { try { await p.getByText(t, { exact }).first().click({ timeout }); return true } catch {} }
  return false
}

const browser = await chromium.launch()

// ── GUEST money loop ──
{
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.removeItem('relish.ops.v1'); localStorage.removeItem('relish.cart.v1') })
  await page.reload({ waitUntil: 'networkidle' }); await wait(page, 2000)
  await tap(page, ['Open Menu', 'View Menu']); await wait(page, 1500)

  // Search overlay
  try { await page.getByRole('button', { name: /search/i }).first().click({ timeout: 2000 }); await wait(page, 900); await page.keyboard.type('paneer'); await wait(page, 900); await shot(page, 'guest-search'); await tap(page, ['Close', 'Done']); await wait(page, 600) } catch (e) { log('search skip', e.message) }

  // Add an item: tap a dish card → Add to Order
  try {
    const card = page.locator('div', { hasText: /₹\d/ }).filter({ has: page.locator('img,video') }).first()
    await card.scrollIntoViewIfNeeded(); await card.click({ timeout: 3000 }); await wait(page, 1200)
    await tap(page, ['Add to Order']); await wait(page, 1000)
    await tap(page, ['Continue', 'Keep browsing', 'Done']); await wait(page, 700) // dismiss add-confirmation slip
  } catch (e) { log('add skip', e.message) }

  // Open the order panel — the bottom-nav cart button
  try { await page.getByRole('button', { name: /order/i }).first().click({ timeout: 2500 }); await wait(page, 1300); await shot(page, 'guest-order-panel') } catch (e) { log('order skip', e.message) }

  // Checkout
  if (await tap(page, ['Pay bill'])) { await wait(page, 1400); await shot(page, 'guest-checkout') }

  // Recommendation flow (fresh)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1500)
  await tap(page, ['Open Menu', 'View Menu']); await wait(page, 1200)
  if (await tap(page, ['Ask AI', 'Recommend Something', 'Recommend'])) { await wait(page, 1600); await shot(page, 'guest-recommend') }

  // Guest loyalty (service → More → Rewards)
  await page.goto(BASE, { waitUntil: 'networkidle' }); await wait(page, 1400)
  await tap(page, ['Open Menu', 'View Menu']); await wait(page, 1000)
  if (await tap(page, ['Call Waiter', 'Waiter'])) {
    await wait(page, 1000)
    if (await tap(page, ['More'])) { await wait(page, 700); if (await tap(page, ['Rewards', 'Loyalty'])) { await wait(page, 900); await shot(page, 'guest-loyalty') } }
  }
  await ctx.close()
}

// ── CONSOLE manager + waiter sub-views ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/#staff`, { waitUntil: 'networkidle' }); await wait(page, 2200)

  const sweep = async (role, navLabels) => {
    await tap(page, [role], { exact: true }); await wait(page, 1600)
    await shot(page, `console-${role.toLowerCase()}-default`)
    for (const label of navLabels) {
      try {
        await page.getByRole('button', { name: label }).first().click({ timeout: 2500 })
        await wait(page, 1500)
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        await shot(page, `console-${role.toLowerCase()}-${slug}`)
      } catch (e) { log(`${role}/${label} skip`, e.message) }
    }
  }

  await sweep('Manager', ['Floor', 'Kitchen', 'Menu', 'Inventory', 'Reservations', 'Reports'])
  await sweep('Waiter', ['My Tables', 'Kitchen', 'Service Queue', 'Billing', 'Reservations'])
  await ctx.close()
}

await browser.close()
log('done')
