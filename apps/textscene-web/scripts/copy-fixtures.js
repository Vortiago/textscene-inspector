import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLATTENED_CORPUS_ROOTS } from '../../../scripts/corpusRoots.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const fixturesSource = join(scenesRoot, 'fixtures');
const fixturesTarget = join(__dirname, '../public/fixtures');

// Cloudflare Pages rejects any deployment containing a file larger than 25 MiB.
// Some vendored godot-demo assets (e.g. uncompressed .hdr sky backgrounds) blow
// past it, so we never copy them into the deploy bundle — the previewer falls
// back to the standard missing-resource placeholder for those few files.
const MAX_DEPLOY_FILE_BYTES = 25 * 1024 * 1024;
const skippedLargeFiles = [];

mkdirSync(fixturesTarget, { recursive: true });

/**
 * Mirror a source tree verbatim, minus files the deploy target refuses.
 * The size skip is the ONLY filter: what a directory contains IS the res://
 * namespace, so anything else here would make the previewer resolve res://
 * differently from Godot (which reads the directory) and from VS Code (which
 * opens it).
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

// scenes/fixtures/ IS the res:// root of the previewer's default corpus, so it
// is mirrored whole: every scene, every resource it references, at the same
// relative path. Godot resolves res:// from the directory holding the scene
// (or its project.godot), and VS Code opens that same directory — mirroring it
// is what makes all three agree on what res:// means.
copyRecursive(fixturesSource, fixturesTarget);
console.log('Mirrored scenes/fixtures/ to public/fixtures/ (res:// root)');

// Mirror each flattened corpus (scenes/<root>/**) into public/fixtures/
// PRESERVING its res:// subpath structure (components/, decorations/,
// tileset/, …) so each scene's `res://...` reference resolves to /fixtures/...
// at fetch time, and a scene one level down keeps that subpath as its fixture
// id (`decorations/candle.tscn`).
//
// This is the DEFINITION of the flattening; scripts/corpusRoots.mjs names the
// roots, and the Godot reference renderer and the sheet resolver read the same
// list to undo it. A root copied here but missing there renders in the
// previewer and nowhere else, which is why the list is shared rather than
// spelled out three times.
//
// Absent on a fresh clone — the try/catch no-ops until the corpus is vendored.
for (const root of FLATTENED_CORPUS_ROOTS) {
  const source = join(scenesRoot, root);
  try {
    if (statSync(source).isDirectory()) {
      copyRecursive(source, fixturesTarget);
      console.log(`Copied ${root} closure to public/fixtures/ (res:// mirrored)`);
    }
  } catch {
    // Corpus not vendored — skip.
  }
}

// Mirror the godot-demo-projects corpora (scenes/demos/**) PRESERVING the
// demos/<top>/<project>/ structure — unlike the flattened corpora above these
// are NOT flattened to the root: each project keeps its own res:// namespace,
// and the web provider resolves res:// against the fixture's `root` subtree.
const demosSource = join(scenesRoot, 'demos');
const demosTarget = join(fixturesTarget, 'demos');
try {
  if (statSync(demosSource).isDirectory()) {
    mkdirSync(demosTarget, { recursive: true });
    copyRecursive(demosSource, demosTarget);
    console.log('Copied godot-demo-projects corpora to public/fixtures/demos/');
  }
} catch {
  // No demos directory — skip.
}

// Mirror the vendored open-source games (scenes/games/**) the same way as the
// demos corpora — each game keeps its own res:// namespace under
// public/fixtures/games/<dir>/, resolved against the fixture's `root`.
//
// DEPLOY-ONLY. The games corpus is gitignored and vendored on demand, and a
// developer who ran `pnpm vendor:games` (to verify against a real game) should
// not thereby get ~140 game scenes in their local scene selector. The deployed
// site does want them, so `pnpm build:deploy` sets the flag; `pnpm dev` and a
// plain `pnpm build` leave them out. `fixturesAll.ts` gates the matching
// manifest on the same variable, so the two halves cannot drift apart.
const includeGames = process.env.VITE_INCLUDE_GAMES === '1';
const gamesSource = join(scenesRoot, 'games');
const gamesTarget = join(fixturesTarget, 'games');
if (!includeGames) {
  // Remove a copy left by an earlier deploy build, so toggling the flag off
  // actually takes effect instead of serving a stale mirror.
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
    // No games directory — skip. A deploy build runs `pnpm vendor:games` first,
    // so this only fires when the flag is set without vendoring.
    console.warn('VITE_INCLUDE_GAMES=1 but scenes/games/ is absent — run `pnpm vendor:games`');
  }
}

if (skippedLargeFiles.length > 0) {
  console.warn(
    `Skipped ${skippedLargeFiles.length} file(s) over ${MAX_DEPLOY_FILE_BYTES / 1024 / 1024} MiB ` +
      `(Cloudflare Pages limit): ${skippedLargeFiles.join(', ')}`
  );
}
