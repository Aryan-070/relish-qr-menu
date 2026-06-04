// Render an interactive tab-menu HTML (e.g. commercial/the-table-theory-menu.html)
// → a print-ready PDF. Unlike render.mjs (which drives Paged.js pitch decks), the
// menu is a single-page app with tab-toggled sections, so this script instead
// expands every section, strips screen-only chrome (sticky nav, fixed grain), and
// lets Chromium paginate one category per page via @page + break rules.
//
// Usage: node scripts/pitch/render-menu.mjs <out.pdf> <input.html>
//   defaults: commercial/TheTableTheory-Menu.pdf  commercial/the-table-theory-menu.html
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] || 'commercial/TheTableTheory-Menu.pdf'
const INPUT = process.argv[3] || 'commercial/the-table-theory-menu.html'
const ROOT = process.cwd()
const PORT = 8124
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]))
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found') }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream')
  fs.createReadStream(file).pipe(res)
})
await new Promise(r => server.listen(PORT, r))

const browser = await chromium.launch()
const page = await browser.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/${INPUT}`, { waitUntil: 'networkidle' })

// Print layout: show every tab section at once, drop screen-only chrome, and
// start each category on a fresh page. break-inside:avoid keeps cards intact.
await page.addStyleTag({ content: `
  @page { size: A4; margin: 14mm 12mm; }
  body::before { display: none !important; }            /* fixed grain overlay */
  .nav-wrap { display: none !important; }                /* sticky tab bar */
  .main { padding: 1.4rem 6mm 0 !important; max-width: none !important; }
  .menu-section { display: block !important; animation: none !important; break-before: page; }
  #bowls { break-before: avoid; }
  .item-card, .combo-card, .build-step, .section-header { break-inside: avoid; }
  .sub-title { break-after: avoid; }
  .item-card:hover { background: var(--surface) !important; }
` })
await page.evaluate(() => {
  document.querySelectorAll('.menu-section').forEach(s => s.classList.add('active'))
})
await page.waitForTimeout(1500) // let webfonts + reflow settle

await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true })
await browser.close()
server.close()
console.log('[render-menu] wrote', OUT, errs.length ? '| errors: ' + errs.slice(0, 3).join(' | ') : '')
