#!/usr/bin/env node
/**
 * key-ingredients.mjs — batch chroma-key ingredient renders into transparent PNGs.
 *
 * Removes a green OR magenta screen from flat ingredient renders, trims to the
 * subject, and writes centred 256×256 transparent PNGs for /public/assets/ingredients/.
 *
 * Robust to UNEVEN / MULTI-SHADE screens: instead of a narrow HSV hue+saturation
 * window (which misses muddy/dark green shades), it keys on channel DOMINANCE
 * — how strongly green (g − max(r,b)) or magenta (min(r,b) − g) a pixel is — which
 * is uniform across bright pure green and dull olive-green alike. The key colour is
 * auto-detected per image from its border.
 *
 * Usage:
 *   node scripts/key-ingredients.mjs [inputDir] [outputDir]
 *   # defaults: in = raw-ingredients (not bundled)   out = public/assets/ingredients
 *
 * Requires: sharp (already in devDependencies).
 */

import sharp from 'sharp'
import { readdir, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

// ── Config ────────────────────────────────────────────────────────────────
const OUT_SIZE = 256          // final square canvas
const SUBJECT_FIT = 224       // subject fit box, then padded to OUT_SIZE (centred)
const PAD = 4                 // extra transparent px around the cropped subject
const ALPHA_CUTOFF = 24       // alpha (0-255) below this = "background" for the crop bbox

// Dominance key thresholds (0-255). dominance = key-channel excess over the others.
const DOM_LO = 30             // <= this → definitely subject (keep, alpha 255)
const DOM_HI = 66             // >= this → definitely screen (remove, alpha 0); ramp between

// Output filename aliases → canonical names the app expects.
const ALIASES = { coffee: 'coffee-bean' }

// ── Helpers ───────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

function canonicalName(fileName) {
  const base = path.parse(fileName).name
    .replace(/-(magenta|green)\b/i, '')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
  return ALIASES[base] ?? base
}

// Detect key colour from a ring of border samples (robust to a busy centre).
function detectKey(data, W, H, C, fileName) {
  if (/-magenta\b/i.test(fileName)) return 'magenta'
  if (/-green\b/i.test(fileName)) return 'green'
  let g = 0, m = 0, n = 0
  const ring = 6 // px in from each edge
  const step = Math.max(1, Math.floor(W / 64))
  const sample = (x, y) => {
    const i = (y * W + x) * C, r = data[i], gr = data[i + 1], b = data[i + 2]
    g += gr - Math.max(r, b)
    m += Math.min(r, b) - gr
    n++
  }
  for (let x = 0; x < W; x += step) { sample(x, ring); sample(x, H - 1 - ring) }
  for (let y = 0; y < H; y += step) { sample(ring, y); sample(W - 1 - ring, y) }
  g /= n; m /= n
  return m > g ? 'magenta' : 'green'
}

// Key one image → trimmed RGBA buffer + bbox (or null if nothing survives).
function keyPixels(data, W, H, C, key) {
  const out = Buffer.alloc(W * H * 4)
  let minX = W, minY = H, maxX = -1, maxY = -1

  for (let i = 0, p = 0; i < W * H; i++, p += C) {
    let r = data[p], g = data[p + 1], b = data[p + 2]

    // dominance of the key colour at this pixel
    const dom = key === 'green' ? g - Math.max(r, b) : Math.min(r, b) - g
    const k = smoothstep(DOM_LO, DOM_HI, dom)      // 0 = subject, 1 = screen
    const alpha = Math.round((1 - k) * 255)

    // despill: pull the residual key tint out of kept/edge pixels
    if (key === 'green') {
      const hi = Math.max(r, b)
      if (g > hi) g = hi
    } else { // magenta: r & b sit above g
      const spill = Math.min(r, b) - g
      if (spill > 0) { r -= spill; b -= spill }
    }

    const o = i * 4
    out[o] = clamp(r, 0, 255); out[o + 1] = clamp(g, 0, 255); out[o + 2] = clamp(b, 0, 255); out[o + 3] = alpha

    if (alpha > ALPHA_CUTOFF) {
      const x = i % W, y = (i / W) | 0
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
  }
  return maxX < 0 ? null : { out, bbox: { minX, minY, maxX, maxY } }
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  const inputDir = path.resolve(process.argv[2] ?? 'raw-ingredients')
  const outputDir = path.resolve(process.argv[3] ?? 'public/assets/ingredients')

  if (!existsSync(inputDir)) {
    console.error(`✗ Input folder not found: ${inputDir}`)
    process.exit(1)
  }
  await mkdir(outputDir, { recursive: true })

  const files = (await readdir(inputDir)).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort()
  if (files.length === 0) { console.error(`✗ No images in ${inputDir}`); process.exit(1) }

  console.log(`Keying ${files.length} image(s)\n  in:  ${inputDir}\n  out: ${outputDir}\n`)
  let ok = 0

  for (const file of files) {
    const name = canonicalName(file)
    try {
      const { data, info } = await sharp(path.join(inputDir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const { width: W, height: H, channels: C } = info
      const key = detectKey(data, W, H, C, file)

      const keyed = keyPixels(data, W, H, C, key)
      if (!keyed) { console.warn(`  ⚠ ${file}: everything keyed out — skipped`); continue }

      const { minX, minY, maxX, maxY } = keyed.bbox
      const cx = clamp(minX - PAD, 0, W - 1), cy = clamp(minY - PAD, 0, H - 1)
      const cw = clamp(maxX - minX + 1 + PAD * 2, 1, W - cx), ch = clamp(maxY - minY + 1 + PAD * 2, 1, H - cy)
      const pad = Math.round((OUT_SIZE - SUBJECT_FIT) / 2)

      await sharp(keyed.out, { raw: { width: W, height: H, channels: 4 } })
        .extract({ left: cx, top: cy, width: cw, height: ch })
        .resize(SUBJECT_FIT, SUBJECT_FIT, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(outputDir, `${name}.png`))

      console.log(`  ✓ ${file.padEnd(16)} → ${name}.png   [${key} key]`)
      ok++
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`)
    }
  }

  console.log(`\nDone — ${ok}/${files.length} written to ${outputDir}`)
}

main().catch(err => { console.error(err); process.exit(1) })
