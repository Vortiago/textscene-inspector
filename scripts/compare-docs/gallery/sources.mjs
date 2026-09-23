/**
 * Everything the gallery reads that is not a sheet: the node catalog, the
 * precomputed lint coverage, the shared-causes notes, and the screenshots.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_ROOT, findImage } from '../sheetSources.mjs';
import { CATEGORY_ORDER } from './vocabulary.mjs';

/** The generators write their JSON beside `build-gallery.mjs`, one level up. */
const COMPARE_DOCS = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A screenshot as a `src` value: a data URI under `--inline`, else a relative
 * path. The `.gif` of an animated node wins over the `.png`, so motion plays.
 */
export function imageSrc(basename, side, inlineImages) {
  const file = findImage(basename, side);
  if (!file) return null;
  const ext = file.endsWith('.gif') ? 'gif' : 'png';
  if (!inlineImages) return `images/${basename}-${side}.${ext}`;
  const mime = ext === 'gif' ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/**
 * The node catalog (`pnpm nodes:catalog`): each Godot node type's dimension,
 * group and support, which groups the nav and makes the "Not implemented" cards.
 */
export function loadCatalog() {
  const file = join(COMPARE_DOCS, 'node-catalog.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { nodes: [], resources: [] };
}

/**
 * Lint coverage per unsupported node, from `pnpm docs:lint-sections`. Read, not
 * computed: a matcher's predicate needs the built linter, and this runs in the
 * web build before core is built. With no file, the cards omit the section.
 */
export function loadLintCoverage() {
  const file = join(COMPARE_DOCS, 'lint-coverage.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).unsupported ?? {} : {};
}

/**
 * The explanatory sections of `docs/comparison/README.md` as a panel, since only
 * `index.html` and `images/` are deployed. Everything from the first category
 * heading on is the file index, which the nav replaces.
 */
export function loadSharedNotes() {
  const file = join(REPO_ROOT, 'docs/comparison/README.md');
  if (!existsSync(file)) return '';
  const body = readFileSync(file, 'utf8');
  const lines = body.split('\n');
  const firstCategory = lines.findIndex(
    (line) => line.startsWith('## ') && CATEGORY_ORDER.includes(line.slice(3))
  );
  const head = firstCategory === -1 ? lines : lines.slice(0, firstCategory);
  return head.join('\n').replace(/^#\s+.*$/m, '').trim();
}
