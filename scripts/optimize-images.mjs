// optimize-images.mjs
//
// Reads original WebP assets from raw-assets/ and writes display-sized,
// re-compressed WebP into public/assets/. Idempotent: re-running always
// derives outputs from the pristine raw-assets/ sources, never from
// previously-optimized files.
//
// Rules (detected generically by filename / folder):
//   dishes/*-hero.webp       -> 860x645  cover, q82   (4:3 hero)
//   dishes/*.webp (plain)    -> 160x160  cover, q80   (square thumbnail)
//   covers/*-banner.webp     -> 860x270  cover, q80   (16:5 category banner)
//   covers/cover-*.webp      -> longest edge <= 900px, q80  (landing bg)
//
// Usage: node scripts/optimize-images.mjs

import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'raw-assets');
const OUT = path.join(ROOT, 'public', 'assets');

const KB = (bytes) => (bytes / 1024).toFixed(1);

// Decide which transform applies to a given raw file.
// Returns null for files that should be skipped (e.g. the Nano Banana orphan).
function planFor(category, filename) {
  if (!filename.toLowerCase().endsWith('.webp')) return null;

  // Skip the unreferenced orphan; it is deleted separately and must never
  // be regenerated into public/assets.
  if (/^nano banana/i.test(filename)) return null;

  if (category === 'dishes') {
    if (/-hero\.webp$/i.test(filename)) {
      return { label: 'hero', apply: (img) => img.resize(860, 645, { fit: 'cover' }) };
    }
    return { label: 'thumb', apply: (img) => img.resize(160, 160, { fit: 'cover' }) };
  }

  if (category === 'covers') {
    if (/-banner\.webp$/i.test(filename)) {
      return { label: 'banner', apply: (img) => img.resize(860, 270, { fit: 'cover' }) };
    }
    if (/^cover-/i.test(filename)) {
      // Longest-edge clamp to 900px, preserve aspect, never upscale.
      return {
        label: 'cover',
        apply: (img) =>
          img.resize(900, 900, { fit: 'inside', withoutEnlargement: true }),
      };
    }
    return null;
  }

  return null;
}

// WebP quality per label.
const QUALITY = { hero: 82, thumb: 80, banner: 80, cover: 80 };

async function processCategory(category, results) {
  const srcDir = path.join(RAW, category);
  const dstDir = path.join(OUT, category);
  await mkdir(dstDir, { recursive: true });

  let entries;
  try {
    entries = await readdir(srcDir);
  } catch (err) {
    console.warn(`! skipping ${category}: ${err.message}`);
    return;
  }

  for (const filename of entries.sort()) {
    const plan = planFor(category, filename);
    if (!plan) {
      if (filename.toLowerCase().endsWith('.webp')) {
        console.log(`  skip  ${category}/${filename}`);
        results.skipped.push(`${category}/${filename}`);
      }
      continue;
    }

    const srcPath = path.join(srcDir, filename);
    const dstPath = path.join(dstDir, filename);
    const oldBytes = (await stat(srcPath)).size;

    await plan
      .apply(sharp(srcPath))
      .webp({ quality: QUALITY[plan.label] })
      .toFile(dstPath);

    const newBytes = (await stat(dstPath)).size;
    results.oldTotal += oldBytes;
    results.newTotal += newBytes;
    results.count += 1;

    console.log(
      `  ${plan.label.padEnd(6)} ${category}/${filename}` +
        `  ${KB(oldBytes)} KB -> ${KB(newBytes)} KB`,
    );
  }
}

async function main() {
  const results = { oldTotal: 0, newTotal: 0, count: 0, skipped: [] };

  console.log('Optimizing images from raw-assets/ -> public/assets/\n');
  await processCategory('dishes', results);
  await processCategory('covers', results);

  const saved = results.oldTotal - results.newTotal;
  console.log('\n--- Summary ---');
  console.log(`Processed: ${results.count} files`);
  if (results.skipped.length) {
    console.log(`Skipped:   ${results.skipped.length} (${results.skipped.join(', ')})`);
  }
  console.log(`Before:    ${KB(results.oldTotal)} KB`);
  console.log(`After:     ${KB(results.newTotal)} KB`);
  console.log(
    `Saved:     ${KB(saved)} KB ` +
      `(${((saved / results.oldTotal) * 100).toFixed(1)}% reduction)`,
  );
}

main().catch((err) => {
  console.error('optimize-images failed:', err);
  process.exit(1);
});
