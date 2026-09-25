#!/usr/bin/env node
/** Generates the web previewer's fixture manifests from the scenes on disk. */

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DEMO_CATEGORY_LABELS } from './generate-fixtures/demoCategories.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @param {string} filename
 * @returns {string}
 */
function detectCategory(filename) {
  if (filename.startsWith('unit-node') || filename.startsWith('unit-empty') || filename.startsWith('unit-camera')) {
    return 'Unit - Basic Nodes';
  }
  if (
    filename.startsWith('unit-box') ||
    filename.startsWith('unit-sphere') ||
    filename.startsWith('unit-cylinder') ||
    filename.startsWith('unit-capsule') ||
    filename.startsWith('unit-plane') ||
    filename.startsWith('unit-torus') ||
    filename.startsWith('unit-prism') ||
    filename.startsWith('unit-quad') ||
    filename.startsWith('unit-mesh') ||
    filename.startsWith('unit-arraymesh')
  ) {
    return 'Unit - Primitive Meshes';
  }
  if (filename.startsWith('unit-csg')) return 'Unit - CSG Primitives';
  if (filename.startsWith('unit-area-light')) return 'Unit - Lights';
  if (filename.startsWith('unit-navigation') || filename.startsWith('unit-nav-')) return 'Unit - Navigation';
  if (filename.startsWith('unit-physics') || filename.startsWith('unit-collision')) return 'Unit - Physics';
  if (filename.startsWith('unit-material')) return 'Unit - Materials';
  if (filename.startsWith('unit-external')) return 'Unit - External Resources';
  if (filename.startsWith('unit-audio')) return 'Unit - Audio';
  // 2D-UI Control nodes, drawn natively in the canvas (ADR-0037).
  if (
    filename.startsWith('unit-control') ||
    filename.startsWith('unit-label-2d') ||
    filename.startsWith('unit-colorrect') ||
    filename.startsWith('unit-color-rect') ||
    filename.startsWith('unit-vbox') ||
    filename.startsWith('unit-hbox') ||
    filename.startsWith('unit-grid-container') ||
    filename.startsWith('unit-center-container') ||
    filename.startsWith('unit-margin-container') ||
    filename.startsWith('unit-scroll-container') ||
    filename.startsWith('unit-panel') ||
    filename.startsWith('unit-button') ||
    filename.startsWith('unit-texture-rect') ||
    filename.startsWith('unit-rich-text-label') ||
    filename.startsWith('unit-canvas-layer') ||
    filename.startsWith('unit-checkbox') ||
    filename.startsWith('unit-optionbutton')
  ) {
    return 'Unit - 2D UI Controls';
  }
  // 2D canvas nodes, not UI, rendered in the R3F viewport.
  if (
    filename.startsWith('unit-node2d') ||
    filename.startsWith('unit-sprite2d') ||
    filename.startsWith('unit-polygon2d') ||
    filename.startsWith('unit-camera2d') ||
    filename.startsWith('unit-tile') ||
    filename.startsWith('unit-marker2d') ||
    filename.startsWith('unit-path2d') ||
    filename.startsWith('unit-pathfollow2d') ||
    filename.startsWith('unit-line2d') ||
    // ParallaxBackground is a CanvasLayer, but its ParallaxLayer children are
    // Node2Ds, so both belong with the canvas fixtures.
    filename.startsWith('unit-parallax-') ||
    filename.startsWith('unit-2d')
  ) {
    return 'Unit - 2D Canvas';
  }
  // Nested viewports (ADR-0033): a sub-viewport hosts both 2D kinds and is a
  // plain Node itself, so it gets its own category.
  if (filename.startsWith('unit-sub-viewport')) return 'Unit - Viewports';
  if (filename.startsWith('edge-')) return 'Edge Cases';
  if (filename.startsWith('integration-external')) return 'Integration - External Scenes';
  if (filename.startsWith('integration-')) return 'Integration - Multi-Node';
  if (filename.startsWith('example-')) return 'Examples - Complex Scenes';
  return 'Other';
}

/**
 * @param {string} filename
 * @returns {string}
 */
function generateName(filename) {
  return filename
    .replace(/^(unit|edge|integration|example)-/, '')
    .replace(/-/g, ' ')
    .replace('.tscn', '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const rootDir = join(__dirname, '..');
const fixturesDir = join(rootDir, 'scenes/fixtures');

// Top-level scenes only: `scenes/fixtures/` is the corpus's res:// root, so a
// subdirectory in it is a res:// namespace (materials/, textures/, fonts/) or a
// nested Godot project, not a shelf of selectable scenes.
const fixtureFiles = readdirSync(fixturesDir)
  .filter(f => f.endsWith('.tscn'))
  .sort();

// Every ld-58 scene at any depth is selectable. `file` is the res://-relative
// path with forward slashes, which matches the closure copy-fixtures mirrors
// under public/fixtures/.
const ld58Dir = join(rootDir, 'scenes/ld58');
function walkTscn(dir, base = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // A missing directory holds no scenes.
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkTscn(join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.tscn')) {
      out.push(rel);
    }
  }
  return out;
}
const ld58Files = walkTscn(ld58Dir).sort();

// The vendored isometric dungeon, mirrored at the public/fixtures root as ld-58
// is, so `res://tileset/...` references resolve.
const isometricDir = join(rootDir, 'scenes/isometric');
const isometricFiles = walkTscn(isometricDir).sort();

// Each demo project (scenes/demos/<top>/<project>/) keeps its own res://
// namespace: copy-fixtures mirrors it under public/fixtures/demos/, and each
// entry's `root` scopes res://. Every scene is listed, subscenes included.
const demosDir = join(rootDir, 'scenes/demos');
function demoProjects() {
  let tops;
  try {
    tops = readdirSync(demosDir, { withFileTypes: true });
  } catch {
    return []; // No demos vendored.
  }
  const out = [];
  for (const top of tops) {
    if (!top.isDirectory() || !DEMO_CATEGORY_LABELS[top.name]) continue;
    for (const project of readdirSync(join(demosDir, top.name), { withFileTypes: true })) {
      if (!project.isDirectory()) continue;
      out.push({ top: top.name, project: project.name });
    }
  }
  return out;
}
function humanizeProject(name) {
  return name
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
/**
 * The project's main scene, project-relative. `run/main_scene` is either a
 * res:// path or (Godot 4.4+) a uid:// reference resolved by scanning the
 * project's .tscn headers. Falls back to main.tscn / the first scene.
 * @param {string} projDir
 * @returns {string | null}
 */
function demoMainScene(projDir) {
  const scenes = walkTscn(projDir).sort();
  if (scenes.length === 0) return null;
  let declared = null;
  try {
    const projectGodot = readFileSync(join(projDir, 'project.godot'), 'utf8');
    declared = /run\/main_scene="([^"]+)"/.exec(projectGodot)?.[1] ?? null;
  } catch {
    // No project.godot vendored: the heuristics below decide.
  }
  if (declared?.startsWith('res://')) {
    const rel = declared.slice('res://'.length);
    if (scenes.includes(rel)) return rel;
  }
  if (declared?.startsWith('uid://')) {
    for (const rel of scenes) {
      const head = readFileSync(join(projDir, rel), 'utf8').slice(0, 200);
      if (head.includes(`uid="${declared}"`)) return rel;
    }
  }
  return scenes.find(rel => rel === 'main.tscn') ?? scenes[0];
}
const demoFixtures = demoProjects().flatMap(({ top, project }) => {
  const root = `demos/${top}/${project}`;
  const label = DEMO_CATEGORY_LABELS[top];
  const projDir = join(demosDir, top, project);
  const scenes = walkTscn(projDir).sort();
  if (scenes.length === 0) return [];
  const mainScene = demoMainScene(projDir);
  return scenes.map((rel) => {
    const isMain = rel === mainScene;
    const stem = rel.replace(/\.tscn$/, '');
    return {
      // The label separates cross-category twins (2d/platformer, 3d/platformer).
      // Subscenes append their project-relative path to stay unique.
      name: isMain
        ? `${humanizeProject(project)} (${label})`
        : `${humanizeProject(project)} (${label}): ${stem}`,
      file: `${root}/${rel}`,
      category: `Godot Demos - ${label}`,
      root,
    };
  });
});

// Vendored open-source games (scenes/games/<dir>/, scripts/vendor-godot-games.mjs),
// with the demos' per-project res:// scheme under public/fixtures/games/<dir>/.
const gamesDir = join(rootDir, 'scenes/games');
const GAME_LABELS = {
  'kenney-platformer': 'Kenney Platformer',
  'godot-open-rpg': 'Open RPG',
  'godot-open-rts': 'Open RTS',
};
function gameDirs() {
  try {
    return readdirSync(gamesDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort();
  } catch {
    return []; // No games vendored.
  }
}
const gameFixtures = gameDirs().flatMap(dir => {
  const root = `games/${dir}`;
  const label = GAME_LABELS[dir] ?? humanizeProject(dir);
  const projDir = join(gamesDir, dir);
  const scenes = walkTscn(projDir)
    // Editor scenes under an addons/ folder at any depth stay on disk so refs
    // resolve, but would flood the selector with plugin UI.
    .filter(rel => !/(^|\/)addons\//.test(rel))
    .sort();
  if (scenes.length === 0) return [];
  const mainScene = demoMainScene(projDir);
  return scenes.map(rel => {
    const isMain = rel === mainScene;
    const stem = rel.replace(/\.tscn$/, '');
    return {
      // Subscenes append their project-relative path to stay unique.
      name: isMain ? label : `${label}: ${stem}`,
      file: `${root}/${rel}`,
      category: `Games - ${label}`,
      root,
    };
  });
});

// The optional ld-58 corpus (scenes/ld58/), vendored on demand with
// `pnpm vendor:ld58` and not committed, like the games corpus.
const ld58Fixtures = ld58Files.map(file => ({
  // Vendored scenes keep Godot's CamelCase / snake_case basenames; split those
  // into words so the selector shows "Clue Container", not "ClueContainer".
  name: generateName(
    file
      .split('/')
      .pop()
      .replace(/_/g, '-')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  ),
  file,
  category: 'Examples - ld-58 Scenes',
}));

const fixtures = [
  ...fixtureFiles.map(file => ({
    name: generateName(file),
    file,
    category: detectCategory(file),
  })),
  ...isometricFiles.map(file => ({
    name: generateName(file.split('/').pop().replace(/_/g, '-')),
    file,
    category: 'Examples - Isometric Dungeon',
  })),
  ...demoFixtures,
];

// The showcase recorder and the scene selector resolve a fixture by its first
// matching name, so a duplicate would load the wrong scene. The optional
// corpora share the name space at runtime, so all sets are checked.
const seenNames = new Map();
for (const fixture of [...fixtures, ...gameFixtures, ...ld58Fixtures]) {
  const prior = seenNames.get(fixture.name);
  if (prior) {
    throw new Error(
      `Duplicate fixture name "${fixture.name}": "${prior}" and "${fixture.file}". ` +
        `Rename one of the scenes so every fixture name is unique.`
    );
  }
  seenNames.set(fixture.name, fixture.file);
}

// Groups fixtures by category, in first-seen category order and declaration
// order within each.
function groupByCategory(items) {
  const categories = [...new Set(items.map(f => f.category))];
  return { categories, sorted: categories.flatMap(cat => items.filter(f => f.category === cat)) };
}

const { categories, sorted: sortedFixtures } = groupByCategory(fixtures);

const output = `/**
 * Scene manifest for the web previewer.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm generate:fixtures
 */

export interface Fixture {
  name: string;
  file: string;
  category: string;
  /** public/fixtures subtree the scene's res:// namespace maps onto ('' = root). */
  root?: string;
}

export const fixtures: Fixture[] = ${JSON.stringify(sortedFixtures, null, 2)};

export function getFixturesByCategory(): Map<string, Fixture[]> {
  const categorized = new Map<string, Fixture[]>();

  for (const fixture of fixtures) {
    const category = fixture.category;
    if (!categorized.has(category)) {
      categorized.set(category, []);
    }
    categorized.get(category)!.push(fixture);
  }

  return categorized;
}
`;

const outputPath = join(rootDir, 'apps/textscene-web/src/fixtures.ts');
writeFileSync(outputPath, output);
console.log(`✅ Generated fixtures.ts with ${fixtures.length} fixtures across ${categories.length} categories`);

/**
 * An optional corpus manifest goes to its own gitignored file, which
 * fixturesAll.ts merges through one import.meta.glob. Each exports
 * `corpusFixtures`, so the glob needs no per-corpus code. With no corpus on
 * disk, a stale manifest is removed.
 */
function writeOptionalCorpusManifest({ fileName, corpusLabel, vendorCmd, items }) {
  const outPath = join(rootDir, 'apps/textscene-web/src', fileName);
  if (items.length > 0) {
    const { categories: corpusCategories, sorted } = groupByCategory(items);
    const manifest = `/**
 * On-demand ${corpusLabel} corpus manifest — AUTO-GENERATED by \`pnpm generate:fixtures\`.
 * Gitignored: the corpus is vendored locally (\`${vendorCmd}\`), not committed.
 * fixturesAll.ts merges this in when present. Do not edit.
 */

import type { Fixture } from './fixtures';

export const corpusFixtures: Fixture[] = ${JSON.stringify(sorted, null, 2)};
`;
    writeFileSync(outPath, manifest);
    console.log(`✅ Generated ${fileName} with ${items.length} ${corpusLabel} fixtures across ${corpusCategories.length} categories`);
  } else if (existsSync(outPath)) {
    rmSync(outPath);
    console.log(`🧹 Removed stale ${fileName} (no ${corpusLabel} vendored)`);
  }
}

writeOptionalCorpusManifest({
  fileName: 'fixtures.games.ts',
  corpusLabel: 'games',
  vendorCmd: 'pnpm vendor:games',
  items: gameFixtures,
});

writeOptionalCorpusManifest({
  fileName: 'fixtures.ld58.ts',
  corpusLabel: 'ld-58',
  vendorCmd: 'pnpm vendor:ld58',
  items: ld58Fixtures,
});
