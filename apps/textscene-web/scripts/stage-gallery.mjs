// Stages the Godot-versus-previewer comparison gallery under public/parity/, which
// Vite copies into dist/ for the dev site on Cloudflare Pages, so it is served at
// /parity/ and linked from the toolbar. The public edition stages nothing. Images are
// referenced, not inlined, and sit beside the HTML.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPublicSiteBuild } from './siteEdition.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const outDir = join(__dirname, '../public/parity');
const imagesSource = join(repoRoot, 'docs/comparison/images');
const imagesTarget = join(outDir, 'images');

// Cloudflare Pages rejects any single file larger than 25 MiB (see copy-fixtures).
const MAX_DEPLOY_FILE_BYTES = 25 * 1024 * 1024;

// The public edition's build reads no public/ (vite.config.ts), so a gallery is wasted work.
if (isPublicSiteBuild()) {
  console.log('Public site edition: no parity gallery staged');
  process.exit(0);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(imagesTarget, { recursive: true });

// The generator's <img> src values are `images/…`, relative to index.html, so
// index.html and images/ sit side by side.
execFileSync(
  'node',
  [join(repoRoot, 'scripts/compare-docs/build-gallery.mjs'), '--out', join(outDir, 'index.html')],
  { stdio: 'inherit' }
);

let copied = 0;
const skippedLargeFiles = [];
for (const file of readdirSync(imagesSource)) {
  if (!/\.(png|gif)$/.test(file)) continue;
  const src = join(imagesSource, file);
  if (statSync(src).size > MAX_DEPLOY_FILE_BYTES) {
    skippedLargeFiles.push(file);
    continue;
  }
  copyFileSync(src, join(imagesTarget, file));
  copied++;
}
console.log(`Staged parity gallery + ${copied} comparison images to public/parity/`);
if (skippedLargeFiles.length) {
  console.warn(`Skipped ${skippedLargeFiles.length} oversized image(s): ${skippedLargeFiles.join(', ')}`);
}
