/**
 * Where the comparison sheets live, so every reader agrees on which files are
 * sheets: `<slice>/comparison.md` in each slice, and the `complex-*` whole-scene
 * showcases, which belong to no slice, in `docs/comparison/sheets/`.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FLATTENED_CORPUS_ROOTS } from '../corpusRoots.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

export { REPO_ROOT };

/** Slice roots, walked for `comparison.md`. */
const SLICE_ROOTS = [
  join(REPO_ROOT, 'packages/textscene-core/src/nodes'),
  join(REPO_ROOT, 'packages/textscene-core/src/resources'),
];

/** The whole-scene showcases, read as plain `*.md`. */
const LOOSE_SHEETS_DIR = join(REPO_ROOT, 'docs/comparison/sheets');

export const IMAGES_DIR = join(REPO_ROOT, 'docs/comparison/images');

function walkFor(dir, fileName, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFor(full, fileName, out);
    else if (entry.name === fileName) out.push(full);
  }
  return out;
}

/**
 * Every sheet file, absolute, sorted for a stable gallery order regardless of
 * filesystem enumeration order.
 */
export function collectSheetFiles() {
  const files = [];
  for (const root of SLICE_ROOTS) {
    // A missing slice root is a broken tree, not a small gallery. Only
    // LOOSE_SHEETS_DIR may be absent.
    if (!existsSync(root)) throw new Error(`Missing slice root: ${root}`);
    walkFor(root, 'comparison.md', files);
  }
  if (existsSync(LOOSE_SHEETS_DIR)) {
    for (const f of readdirSync(LOOSE_SHEETS_DIR)) {
      if (f.endsWith('.md')) files.push(join(LOOSE_SHEETS_DIR, f));
    }
  }
  return files.sort();
}

/** A sheet path as the short, repo-relative label used in error messages. */
export const sheetLabel = (file) =>
  file.startsWith(REPO_ROOT) ? file.slice(REPO_ROOT.length + 1) : file;

/**
 * Splits `--- key: value ---` frontmatter from the body, or `null` if absent,
 * since callers differ on what that means. The trailing-`#` strip serves the
 * inline comments SHEET-STANDARD documents on frontmatter values.
 */
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].replace(/\s*#.*$/, '').trim();
  }
  return { meta, body: match[2] };
}

/**
 * Frontmatter keys hidden behind a `#` comment, such as `# image: unit-foo`,
 * which the `new:node` scaffold ships. `parseFrontmatter` never sees them, so
 * the sheet silently gets no capture target. Only the `---` block is scanned.
 */
export function findCommentedFrontmatterKeys(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) return [];
  const found = [];
  for (const line of match[1].split('\n')) {
    const commented = /^#\s*(\w+):/.exec(line.trim());
    if (commented) found.push(commented[1]);
  }
  return found;
}

/**
 * The compare-marker syntax as a pattern source, so the section walk and the
 * orphan detector in `gallery/sheetParsing.mjs` build their anchored and
 * unanchored forms from one definition and cannot drift apart.
 */
export const COMPARE_MARKER_PATTERN = String.raw`<!--\s*compare:\s*(.*?)\s*-->`;

/** Parse a marker's `key=value` attributes. */
export const compareMarkerAttrs = (attrs) =>
  Object.fromEntries(attrs.split(/\s+/).map((kv) => kv.split('=')));

/** Every `<!-- compare: image=… status=… fixture=… -->` marker in a sheet body. */
export function parseCompareMarkers(body) {
  return [...body.matchAll(new RegExp(COMPARE_MARKER_PATTERN, 'g'))].map((m) =>
    compareMarkerAttrs(m[1])
  );
}

/**
 * A screenshot's path, or `null`. The `.gif` of an animated node wins over the
 * `.png`, so a motion node plays.
 */
export function findImage(basename, side) {
  for (const ext of ['gif', 'png']) {
    const file = join(IMAGES_DIR, `${basename}-${side}.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

const SCENES_DIR = join(REPO_ROOT, 'scenes');
let sceneIndex = null;

/**
 * Resolves a `fixture:` value to an absolute path, or `null`. A value with `/`
 * resolves only under `scenes/` or a flattened corpus root: `scenes/` repeats
 * basenames such as `game.tscn`, so the basename index serves bare names only.
 */
export function findScene(fixture) {
  const direct = join(SCENES_DIR, fixture);
  if (existsSync(direct)) return direct;
  if (fixture.includes('/')) {
    // copy-fixtures flattens these roots onto public/fixtures, so an id keeps
    // its res:// subpath (`decorations/candle.tscn`). This undoes it for Godot.
    // Two roots with one subpath would already collide in copy-fixtures.
    for (const root of FLATTENED_CORPUS_ROOTS) {
      const inCorpus = join(SCENES_DIR, root, fixture);
      if (existsSync(inCorpus)) return inCorpus;
    }
    return null;
  }

  // A bare name is a unit fixture first; only then a corpus scene elsewhere in
  // the tree. Order matters when a basename occurs twice.
  const inFixtures = join(SCENES_DIR, 'fixtures', fixture);
  if (existsSync(inFixtures)) return inFixtures;
  if (!sceneIndex) {
    sceneIndex = new Map();
    const walk = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.tscn') && !sceneIndex.has(entry.name)) {
          sceneIndex.set(entry.name, full);
        }
      }
    };
    if (existsSync(SCENES_DIR)) walk(SCENES_DIR);
  }
  return sceneIndex.get(fixture.split('/').pop()) ?? null;
}

/**
 * Sheets with no single type behind them, so no generated lint block: the
 * `complex-*` showcases. Resources are not exempt, since the same registry
 * validates them. Shared by the generator and the test that checks it.
 */
export const LINT_EXEMPT_CATEGORIES = new Set(['Complex Scenes']);
