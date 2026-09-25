import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLATTENED_CORPUS_ROOTS } from '../../../scripts/corpusRoots.mjs';
import { isPublicSiteBuild } from './siteEdition.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const fixturesSource = join(scenesRoot, 'fixtures');
const fixturesTarget = join(__dirname, '../public/fixtures');

// The public edition's build reads no public/ (vite.config.ts), so a mirror is wasted work.
if (isPublicSiteBuild()) {
  console.log('Public site edition: no fixtures mirrored');
  process.exit(0);
}

// Cloudflare Pages rejects a deployment holding a file over 25 MiB, such as an
// uncompressed .hdr sky in the godot demos. Such a file is not copied, and the
// previewer shows the missing-resource placeholder for it.
const MAX_DEPLOY_FILE_BYTES = 25 * 1024 * 1024;
const skippedLargeFiles = [];

mkdirSync(fixturesTarget, { recursive: true });

/**
 * Mirrors a source tree, minus files the deploy target refuses. The size skip is
 * the only filter: the directory is the res:// namespace, so any other filter makes
 * the previewer resolve res:// unlike Godot and VS Code, which read the directory.
 */
function copyRecursive(src, dest) {
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(d, { recursive: true });
      copyRecursive(s, d);
    } else if (statSync(s).size > MAX_DEPLOY_FILE_BYTES) {
      skippedLargeFiles.push(relative(scenesRoot, s));
    } else {
      copyFileSync(s, d);
    }
  }
}

// scenes/fixtures/ is the res:// root of the default corpus, so it is mirrored
// whole at the same relative paths. Godot resolves res:// from that directory and
// VS Code opens it, so the mirror makes all three agree on res://.
copyRecursive(fixturesSource, fixturesTarget);
console.log('Mirrored scenes/fixtures/ to public/fixtures/ (res:// root)');

// This defines the flattening: each scenes/<root>/** lands in public/fixtures/ with
// its res:// subpaths, and a nested scene keeps its subpath as its id
// (`decorations/candle.tscn`). scripts/corpusRoots.mjs names the roots for the Godot
// reference renderer and the sheet resolver too, so no root renders here alone.
for (const root of FLATTENED_CORPUS_ROOTS) {
  const source = join(scenesRoot, root);
  try {
    if (statSync(source).isDirectory()) {
      copyRecursive(source, fixturesTarget);
      console.log(`Copied ${root} closure to public/fixtures/ (res:// mirrored)`);
    }
  } catch {
    // A fresh clone has not vendored the corpus.
  }
}

// The godot-demo-projects corpora keep their demos/<top>/<project>/ structure,
// not flattened: each project has its own res:// namespace, which the web provider
// resolves against the fixture's `root` subtree.
const demosSource = join(scenesRoot, 'demos');
const demosTarget = join(fixturesTarget, 'demos');
try {
  if (statSync(demosSource).isDirectory()) {
    mkdirSync(demosTarget, { recursive: true });
    copyRecursive(demosSource, demosTarget);
    console.log('Copied godot-demo-projects corpora to public/fixtures/demos/');
  }
} catch {
  // No demos directory.
}

// The vendored games keep their own res:// namespace under public/fixtures/games/<dir>/,
// as the demos do. Deploy only: `pnpm vendor:games` does not fill the local scene
// selector, and only `pnpm build:deploy` sets the flag. `fixturesAll.ts` gates the
// matching manifest on the same variable.
const includeGames = process.env.VITE_INCLUDE_GAMES === '1';
const gamesSource = join(scenesRoot, 'games');
const gamesTarget = join(fixturesTarget, 'games');
if (!includeGames) {
  // A copy from an earlier deploy build goes, so turning the flag off takes effect.
  rmSync(gamesTarget, { recursive: true, force: true });
  console.log('Skipped vendored games (set VITE_INCLUDE_GAMES=1 to include them)');
} else {
  try {
    if (statSync(gamesSource).isDirectory()) {
      mkdirSync(gamesTarget, { recursive: true });
      copyRecursive(gamesSource, gamesTarget);
      console.log('Copied vendored Godot games to public/fixtures/games/');
    }
  } catch {
    // A deploy build runs `pnpm vendor:games` first, so this fires only when the
    // flag is set without vendoring.
    console.warn('VITE_INCLUDE_GAMES=1 but scenes/games/ is absent — run `pnpm vendor:games`');
  }
}

if (skippedLargeFiles.length > 0) {
  console.warn(
    `Skipped ${skippedLargeFiles.length} file(s) over ${MAX_DEPLOY_FILE_BYTES / 1024 / 1024} MiB ` +
      `(Cloudflare Pages limit): ${skippedLargeFiles.join(', ')}`
  );
}
