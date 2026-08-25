/**
 * Where the comparison sheets live, for every tool that reads them.
 *
 * A sheet is slice content — it documents the very `parser.ts` / `linterParser.ts`
 * beside it — so it sits in the slice as `<slice>/comparison.md`. The four
 * `complex-*` whole-scene showcases belong to no slice and stay in
 * `docs/comparison/sheets/`.
 *
 * Both roots are walked here so `build-gallery.mjs` and `recapture.mjs` can never
 * disagree about which files are sheets.
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

/** The sliceless residue — whole-scene showcases, read as plain `*.md`. */
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
    // Unconditional in a valid checkout — a missing one means a broken tree, and
    // silently returning only the loose showcases would build a 4-sheet gallery
    // and exit 0. Only LOOSE_SHEETS_DIR is allowed to be absent.
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
 * Split `--- key: value ---` frontmatter from the body, or `null` if absent.
 *
 * Callers differ on what an absent block means (the gallery throws, the
 * generators skip), so this reports rather than decides. The trailing-`#` strip
 * is load-bearing: the `new:node` scaffold ships `# image: …` commented out, and
 * SHEET-STANDARD documents inline comments on frontmatter values.
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

/** Every `<!-- compare: image=… status=… fixture=… -->` marker in a sheet body. */
export function parseCompareMarkers(body) {
  return [...body.matchAll(/<!--\s*compare:\s*(.*?)\s*-->/g)].map((m) =>
    Object.fromEntries(m[1].split(/\s+/).map((kv) => kv.split('=')))
  );
}

/**
 * A screenshot's path, or `null`. Extension order is load-bearing: an animated
 * node writes a `.gif` and a still writes a `.png`, and the gif must win so a
 * motion node plays.
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
 * Resolve a `fixture:` value to an absolute path, or `null`.
 *
 * A value containing `/` names an exact path under `scenes/` and resolves ONLY
 * there, or under one of the corpus roots the web previewer flattens (below).
 * The basename index is for bare names alone: `scenes/` holds many repeated
 * basenames (`game.tscn`, `level.tscn`, `main.tscn` across the vendored demos),
 * so letting a stale `demos/…/game.tscn` fall through to it would silently
 * return an unrelated scene — and recapture would render that into the
 * committed parity baseline.
 */
export function findScene(fixture) {
  const direct = join(SCENES_DIR, fixture);
  if (existsSync(direct)) return direct;
  if (fixture.includes('/')) {
    // A `fixture:` value is the previewer's `?fixture=` id, and copy-fixtures
    // flattens these corpus roots onto the public/fixtures root so their scenes
    // keep their own res:// subpaths as ids (`decorations/candle.tscn`). Godot
    // needs the repo path, so undo that flattening the same way it was applied.
    // No ambiguity to guard: two roots holding the same subpath would already
    // have collided when copy-fixtures wrote them into one directory.
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
 * `complex-*` whole-scene showcases.
 *
 * Resources are NOT exempt: they are validated by the same registry the
 * generator reads, and with the base-walk covering Godot's resource ancestry a
 * material sheet has a substantial table to show. Exempting them is a blank
 * page over real
 * coverage.
 *
 * Shared because the generator decides which sheets GET a block and the test
 * asserts which sheets must NOT have one; two copies would drift into either a
 * red test or a sheet that silently never gets generated.
 */
export const LINT_EXEMPT_CATEGORIES = new Set(['Complex Scenes']);
