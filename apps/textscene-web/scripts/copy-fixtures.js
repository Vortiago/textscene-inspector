import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const fixturesSource = join(scenesRoot, 'fixtures');
const examplesSource = join(scenesRoot, 'examples');
const fixturesTarget = join(__dirname, '../public/fixtures');

// Cloudflare Pages rejects any deployment containing a file larger than 25 MiB.
// Some vendored godot-demo assets (e.g. uncompressed .hdr sky backgrounds) blow
// past it, so we never copy them into the deploy bundle — the previewer falls
// back to the standard missing-resource placeholder for those few files.
const MAX_DEPLOY_FILE_BYTES = 25 * 1024 * 1024;
const skippedLargeFiles = [];

mkdirSync(fixturesTarget, { recursive: true });

// Copy from scenes/fixtures/ — scenes (.tscn) plus any sibling text resources
// (.tres) a fixture references via `res://<name>.tres` at the fixtures root
// (e.g. an external ArrayMesh).
const fixtureFiles = readdirSync(fixturesSource).filter(
  (file) => file.endsWith('.tscn') || file.endsWith('.tres')
);
for (const file of fixtureFiles) {
  copyFileSync(join(fixturesSource, file), join(fixturesTarget, file));
}

// Copy textures directory from scenes/fixtures/
const texturesSource = join(fixturesSource, 'textures');
const texturesTarget = join(fixturesTarget, 'textures');
try {
  if (statSync(texturesSource).isDirectory()) {
    mkdirSync(texturesTarget, { recursive: true });
    const textureFiles = readdirSync(texturesSource);
    for (const file of textureFiles) {
      copyFileSync(join(texturesSource, file), join(texturesTarget, file));
    }
    console.log(`Copied ${textureFiles.length} texture files to public/fixtures/textures/`);
  }
} catch {
  // Textures directory doesn't exist yet, skip
}

// Copy from scenes/examples/
const exampleFiles = readdirSync(examplesSource).filter((file) => file.endsWith('.tscn'));
for (const file of exampleFiles) {
  copyFileSync(join(examplesSource, file), join(fixturesTarget, file));
}

const totalFiles = fixtureFiles.length + exampleFiles.length;
console.log(`Copied ${totalFiles} scene files to public/fixtures/ (${fixtureFiles.length} fixtures + ${exampleFiles.length} examples)`);

// Mirror the optional locally-vendored corpus (scenes/ld58/**) into
// public/fixtures/ PRESERVING its res:// subpath structure (components/,
// assets/textures/, …) so each scene's `res://...` references resolve to
// /fixtures/... at fetch time. Absent on a fresh clone — the try/catch no-ops
// until the corpus is vendored (`pnpm vendor:ld58`).
const ld58Source = join(scenesRoot, 'ld58');
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
try {
  if (statSync(ld58Source).isDirectory()) {
    copyRecursive(ld58Source, fixturesTarget);
    console.log('Copied the vendored corpus to public/fixtures/ (res:// mirrored)');
  }
} catch {
  // Corpus not vendored — skip.
}

// Copy the vendored isometric-dungeon closure (scenes/isometric/**) the same
// way — its res:// references (tileset/, decorations/, player/) resolve at
// the public/fixtures root.
const isometricSource = join(scenesRoot, 'isometric');
try {
  if (statSync(isometricSource).isDirectory()) {
    copyRecursive(isometricSource, fixturesTarget);
    console.log('Copied isometric-dungeon closure to public/fixtures/ (res:// mirrored)');
  }
} catch {
  // No isometric directory — skip.
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
const gamesSource = join(scenesRoot, 'games');
const gamesTarget = join(fixturesTarget, 'games');
try {
  if (statSync(gamesSource).isDirectory()) {
    mkdirSync(gamesTarget, { recursive: true });
    copyRecursive(gamesSource, gamesTarget);
    console.log('Copied vendored Godot games to public/fixtures/games/');
  }
} catch {
  // No games directory — skip.
}

// Copy materials directory from scenes/materials/
const materialsSource = join(scenesRoot, 'materials');
const materialsTarget = join(fixturesTarget, 'materials');
try {
  if (statSync(materialsSource).isDirectory()) {
    mkdirSync(materialsTarget, { recursive: true });
    const materialFiles = readdirSync(materialsSource);
    for (const file of materialFiles) {
      copyFileSync(join(materialsSource, file), join(materialsTarget, file));
    }
    console.log(`Copied ${materialFiles.length} material files to public/fixtures/materials/`);
  }
} catch {
  // Materials directory doesn't exist yet, skip
}

if (skippedLargeFiles.length > 0) {
  console.warn(
    `Skipped ${skippedLargeFiles.length} file(s) over ${MAX_DEPLOY_FILE_BYTES / 1024 / 1024} MiB ` +
      `(Cloudflare Pages limit): ${skippedLargeFiles.join(', ')}`
  );
}
