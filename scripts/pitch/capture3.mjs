// Focused: capture guest-checkout (needs a non-empty cart first).
import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const OUT = 'assets/pitch/screens'
const log = (...a) => console.log('[capture3]', ...a)
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
const tap = async (texts, { exact = false, timeout = 3000 } = {}) => {
  for (const t of texts) { try { await p.getByText(t, { exact }).first().click({ timeout }); return true } catch {} }
  return false
}
await p.goto(BASE, { waitUntil: 'networkidle' })
await p.evaluate(() => { localStorage.removeItem('relish.ops.v1'); localStorage.removeItem('relish.cart.v1') })
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
await tap(['Open Menu', 'View Menu']); await p.waitForTimeout(1500)
// open a dish and add it (retry a few cards until cart shows a count)
let added = false
for (let i = 0; i < 4 && !added; i++) {
  try {
    const card = p.locator('div', { hasText: /₹\d/ }).filter({ has: p.locator('img,video') }).nth(i)
    await card.scrollIntoViewIfNeeded(); await card.click({ timeout: 2500 }); await p.waitForTimeout(1100)
    if (await tap(['Add to Order'])) {
      await p.waitForTimeout(1000)
      await tap(['Continue', 'Keep browsing', 'Done', 'Show to Waiter']) // dismiss slip
      await p.waitForTimeout(700)
      const body = await p.innerText('body')
      added = /item ·|My Order\s*\d|1 item|2 item/i.test(body)
      log('attempt', i, 'added=', added)
    }
  } catch (e) { log('attempt', i, 'err', e.message) }
}
// open the order panel then checkout
await tap(['My Order', 'Order'], {}); await p.waitForTimeout(1300)
if (await tap(['Pay bill'])) {
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${OUT}/guest-checkout.png` })
  log('✓ guest-checkout')
} else {
  log('✗ Pay bill not found; saving order panel as fallback')
  await p.screenshot({ path: `${OUT}/guest-checkout.png` })
}
await b.close()
