/**
 * Convert all PNG files in public/assets/ to WebP at 85% quality.
 * Deletes the original PNG after successful conversion.
 * Run from the project root: node scripts/convert-to-webp.mjs
 */
import { readdir, unlink } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

async function findPngs(dir) {
  let results = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      results = results.concat(await findPngs(fullPath))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
      results.push(fullPath)
    }
  }
  return results
}

const root = 'public/assets'
const pngs = await findPngs(root)

if (pngs.length === 0) {
  console.log('No PNG files found — nothing to convert.')
  process.exit(0)
}

console.log(`Found ${pngs.length} PNG file(s). Converting to WebP at 85% quality...\n`)

let ok = 0
let failed = 0

for (const src of pngs) {
  const dest = src.replace(/\.png$/i, '.webp')
  try {
    await sharp(src).webp({ quality: 85 }).toFile(dest)
    await unlink(src)
    console.log(`  ✓ ${src} → ${dest}`)
    ok++
  } catch (err) {
    console.error(`  ✗ ${src} — ${err.message}`)
    failed++
  }
}

console.log(`\nDone: ${ok} converted, ${failed} failed.`)
