// Render pitch/index.html → Relish-Pitch-by-TheShahStack.pdf
// Serves the repo over a throwaway HTTP server (Paged.js fetch()es the linked
// stylesheet, which Chromium blocks under file://), lets Paged.js paginate
// (page numbers, running headers, full-bleed pages), then prints honoring @page.
import { chromium } from 'playwright'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const OUT = process.argv[2] || 'Relish-Pitch-by-TheShahStack.pdf'
const ROOT = process.cwd()
const PORT = 8123
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
await page.goto(`http://localhost:${PORT}/pitch/index.html`, { waitUntil: 'networkidle' })
await page.waitForSelector('.pagedjs_page', { timeout: 90000 })
await page.waitForTimeout(3000)
const pages = await page.locator('.pagedjs_page').count()
console.log('[render] paged pages:', pages, errs.length ? '| errors: ' + errs.slice(0, 3).join(' | ') : '')

await page.pdf({ path: OUT, printBackground: true, preferCSSPageSize: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
await browser.close()
server.close()
console.log('[render] wrote', OUT)
