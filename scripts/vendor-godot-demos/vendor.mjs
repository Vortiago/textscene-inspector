/**
 * Vendors godot-demo-projects at a pinned commit into two gitignored corpora: each project under
 * 2d/, 3d/, gui/ and viewport/ into scenes/demos/<top>/<project>/, and the closure of
 * 2d/isometric/dungeon.tscn into scenes/isometric/, the TileMapLayer corpus. It applies the local
 * changes in this folder and prunes what the previewer never reads. A key file in each corpus names
 * the recipe that made it, so an unchanged recipe fetches nothing.
 */

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { fetchShallow } from '../vendor-git.mjs';
import { copyPruned, isPruned } from '../vendor-prune.mjs';
import { applyLocalChanges } from './applyLocalChanges.mjs';
import { reachableFiles } from './reachableFiles.mjs';

const SOURCE = {
  url: 'https://github.com/godotengine/godot-demo-projects',
  commit: '419eae0c39be0234d5454ee491b16d938fa12d65',
};
const SHORT_COMMIT = SOURCE.commit.slice(0, 12);

const DEMOS = join(REPO_ROOT, 'scenes/demos');
const ISOMETRIC = join(REPO_ROOT, 'scenes/isometric');
const TOPS = ['2d', '3d', 'gui', 'viewport'];
const ISOMETRIC_PROJECT = '2d/isometric';
/** The scenes under scenes/isometric/ that are ours and committed. The vendoring leaves them. */
const ISOMETRIC_OWN_DIR = 'previews';
const CORPORA = [DEMOS, ISOMETRIC];
const KEY_FILE = '.vendor-key';

/** The files and folders that decide the corpora. A change to one of them fetches again. */
const RECIPE = [
  'scripts/vendor-godot-demos/vendor.mjs',
  'scripts/vendor-godot-demos/applyLocalChanges.mjs',
  'scripts/vendor-godot-demos/reachableFiles.mjs',
  'scripts/vendor-godot-demos/local-changes.patch',
  'scripts/vendor-godot-demos/text-resources',
  'scripts/vendor-prune.mjs',
  'scripts/vendor-git.mjs',
];

const LICENCE = `License: code is MIT, Copyright (c) 2014-present Godot Engine contributors,
Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur
(https://github.com/godotengine/godot-demo-projects/blob/master/LICENSE.md).
Per-demo asset licences vary (often CC-BY). Each project keeps its own README.md for attribution.`;

/**
 * Vendors both corpora, unless each already holds the current recipe's output. When the fetch
 * fails, it keeps corpora from an older recipe and throws only when there are none.
 */
export function ensureGodotDemos() {
  const key = recipeKey();
  if (CORPORA.every((corpus) => holdsKey(corpus, key))) {
    console.log(`[vendor-godot-demos] up to date @ ${SHORT_COMMIT}`);
    return;
  }
  const work = mkdtempSync(join(tmpdir(), 'vendor-godot-demos-'));
  try {
    const checkout = join(work, 'godot-demo-projects');
    try {
      fetchCheckout(checkout);
    } catch (e) {
      // Offline, an older recipe's corpora beat none: the install and the tests still run.
      if (!CORPORA.every((corpus) => existsSync(join(corpus, KEY_FILE)))) throw e;
      console.warn(`[vendor-godot-demos] ${e.message}\n  Kept the corpora of an older recipe.`);
      return;
    }
    applyLocalChanges(import.meta.dirname, checkout);
    const demoFiles = vendorDemos(checkout);
    const isometricFiles = vendorIsometric(join(checkout, ISOMETRIC_PROJECT));
    for (const corpus of CORPORA) writeFileSync(join(corpus, KEY_FILE), key);
    console.log(
      `[vendor-godot-demos] ${demoFiles} demo files and ${isometricFiles} isometric files @ ${SHORT_COMMIT}`
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** A hash of the recipe's files, which CI also keys its cache on. */
export function recipeKey() {
  const hash = createHash('sha256');
  for (const file of RECIPE.flatMap(recipeFiles).sort()) {
    // A NUL after each part keeps one path and its bytes from reading as another pair.
    hash
      .update(`${file}\0`)
      .update(readFileSync(join(REPO_ROOT, file)))
      .update('\0');
  }
  return hash.digest('hex');
}

/** The repo-relative POSIX paths of the files at `path`, a file or a folder. */
function recipeFiles(path) {
  const full = join(REPO_ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(REPO_ROOT, join(e.parentPath, e.name)).split(sep).join('/'));
}

function holdsKey(corpus, key) {
  const file = join(corpus, KEY_FILE);
  return existsSync(file) && readFileSync(file, 'utf8') === key;
}

function fetchCheckout(checkout) {
  console.log(`[vendor-godot-demos] fetching ${SOURCE.url} @ ${SHORT_COMMIT}`);
  try {
    fetchShallow(SOURCE.url, SOURCE.commit, checkout);
  } catch (e) {
    throw new Error(
      `could not fetch ${SOURCE.url} @ ${SOURCE.commit}. Check the network access: ${e.stderr ?? e}`,
      { cause: e }
    );
  }
}

/** Copies each demo project, pruned, into a wiped scenes/demos/, and returns the file count. */
function vendorDemos(checkout) {
  rmSync(DEMOS, { recursive: true, force: true });
  let files = 0;
  for (const top of TOPS) {
    for (const project of readdirSync(join(checkout, top), { withFileTypes: true })) {
      const rel = `${top}/${project.name}`;
      if (!project.isDirectory() || rel === ISOMETRIC_PROJECT) continue;
      files += copyPruned(join(checkout, rel), join(DEMOS, rel));
    }
  }
  writeFileSync(join(DEMOS, 'README.md'), demosReadme());
  return files;
}

/**
 * Copies the closure of dungeon.tscn into scenes/isometric/ beside the committed previews, and
 * returns the file count. Without project.godot the folder is a res:// root that
 * scripts/corpusRoots.mjs declares.
 */
function vendorIsometric(project) {
  for (const entry of existsSync(ISOMETRIC) ? readdirSync(ISOMETRIC) : []) {
    if (entry !== ISOMETRIC_OWN_DIR) rmSync(join(ISOMETRIC, entry), { recursive: true, force: true });
  }
  const files = reachableFiles(project, 'dungeon.tscn').filter((rel) => !isPruned(join(project, rel)));
  for (const rel of files) cpSync(join(project, rel), join(ISOMETRIC, rel));
  writeFileSync(join(ISOMETRIC, 'README.md'), isometricReadme());
  return files.length;
}

function demosReadme() {
  return `# Godot demo projects (vendored)

The visual categories (2d/, 3d/, gui/, viewport/) of
[godotengine/godot-demo-projects](${SOURCE.url})
at \`${SOURCE.commit}\`, a breadth corpus for previewer QA. The web previewer lists every scene
under the "Godot Demos - …" categories, and each project keeps its own res:// namespace (the
fixture manifest's \`root\` field).

\`pnpm vendor:demos\` writes this folder, and git ignores it. \`2d/isometric\` is at
\`scenes/isometric/\`. \`scripts/vendor-godot-demos/README.md\` lists the prune and the local changes.

${LICENCE}
`;
}

function isometricReadme() {
  return `# Isometric Dungeon (vendored)

The \`2d/isometric\` demo of [godotengine/godot-demo-projects](${SOURCE.url})
at \`${SOURCE.commit}\`, the real-game corpus for TileMapLayer rendering: four TileMapLayer
nodes over an external \`.tres\` TileSet with five atlas sources (ISOMETRIC shape, DIAMOND_DOWN
layout, 128×64 tiles, authored alternative tiles with flip and transpose).

\`pnpm vendor:demos\` writes every file that \`dungeon.tscn\` reaches through its \`ext_resource\`
paths, with their import sidecars. It writes no \`project.godot\`, so \`scripts/corpusRoots.mjs\`
declares this folder a res:// root. \`previews/\` is ours and committed (see \`previews/README.md\`).

${LICENCE}
`;
}
