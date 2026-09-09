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
 * A screenshot as a `src` value — a data URI under `--inline`, else a relative
 * path. An animated node (AnimationPlayer) writes a `.gif`; a still writes a
 * `.png`. Prefer the gif so a motion node plays, and fall back to the png.
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
 * The node catalog (`pnpm nodes:catalog`) maps every Godot node type to its
 * dimension and functional group and whether the previewer supports it. It lets
 * the gallery (a) group the nav by function and (b) list the not-yet-supported
 * nodes as their own "Not implemented" sheets instead of in a side document.
 */
export function loadCatalog() {
  const file = join(COMPARE_DOCS, 'node-catalog.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { nodes: [], resources: [] };
}

/**
 * Per-unsupported-node lint coverage, precomputed by `pnpm docs:lint-sections`.
 *
 * Read rather than computed: deciding whether a matcher rule reaches a node type
 * means EXECUTING its predicate, which needs the built linter — and this script
 * runs inside the web build before core is built. Absent file: the cards simply
 * omit the section.
 */
export function loadLintCoverage() {
  const file = join(COMPARE_DOCS, 'lint-coverage.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).unsupported ?? {} : {};
}

/**
 * The explanatory sections of `docs/comparison/README.md`, as their own panel.
 *
 * A cause that spans sheets is written there once and each sheet points at it.
 * Only `index.html` and `images/` are deployed, so on the published site that
 * pointer would otherwise be a dead end: the canonical text unreachable from the
 * very page citing it. Carrying the sections into the gallery keeps the whole
 * thing self-contained, with no link out to a private repo.
 *
 * Everything from the first category heading onward is the repo-facing file
 * index, which the nav already supersedes.
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
