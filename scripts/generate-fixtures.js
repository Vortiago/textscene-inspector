#!/usr/bin/env node
/**
 * Auto-generate fixtures.ts from filesystem
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
  // 2D-UI Control nodes rendered via the DOM overlay (ADR-0003).
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
  // 2D canvas (non-UI) nodes rendered in the R3F viewport (Node2D/Sprite2D/Camera2D/TileMap).
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
    // ParallaxBackground is a CanvasLayer, but it hosts world-canvas content
    // (its ParallaxLayer children are Node2Ds), so both belong with the canvas
    // fixtures rather than the DOM-overlay ones.
    filename.startsWith('unit-parallax-') ||
    filename.startsWith('unit-2d')
  ) {
    return 'Unit - 2D Canvas';
  }
  // Nested viewports (ADR-0030) — a sub-viewport and the surfaces that display
  // it. Its own category because it is neither 2D-canvas nor 2D-UI content: a
  // sub-viewport hosts BOTH kinds and is a plain Node itself.
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

// Read fixtures
const rootDir = join(__dirname, '..');
const fixturesDir = join(rootDir, 'scenes/fixtures');
const examplesDir = join(rootDir, 'scenes/examples');

const fixtureFiles = readdirSync(fixturesDir)
  .filter(f => f.endsWith('.tscn'))
  .sort();
const exampleFiles = readdirSync(examplesDir)
  .filter(f => f.endsWith('.tscn'))
  .sort();

// Top-level ld-58 scenes (their res:// deps live in scenes/ld58/<subdirs> and
// are NOT listed as selectable fixtures). copy-fixtures mirrors the closure
// under public/fixtures/ so the res:// references resolve.
// Walk scenes/ld58/ RECURSIVELY: top-level scenes (hallway-geometry) plus
// nested ones (Scenes/GameUI/GameUI.tscn, components/WallSection.tscn, …) are
// all selectable. `file` is the res://-relative path (forward slashes) so it
// matches the mirror copy-fixtures writes under public/fixtures/.
const ld58Dir = join(rootDir, 'scenes/ld58');
function walkTscn(dir, base = '') {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // No ld58 directory — skip.
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

// The vendored godot-demo-projects isometric dungeon (scenes/isometric/) —
// same mirroring scheme as ld-58: copy-fixtures lays its closure out at the
// public/fixtures root so `res://tileset/...` references resolve.
const isometricDir = join(rootDir, 'scenes/isometric');
const isometricFiles = walkTscn(isometricDir).sort();

// Vendored godot-demo-projects corpora (scenes/demos/<top>/<project>/) —
// each project keeps its own res:// namespace: copy-fixtures mirrors the
// whole tree under public/fixtures/demos/, and each fixture entry carries a
// `root` so the web provider resolves res:// against that project's subtree.
//
// EVERY scene in a project is listed so subscenes (e.g. a platformer's
// coin.tscn) are browsable in the selector, not just the project's main
// scene. The main scene keeps the tidy `Project (Label)` name; subscenes are
// path-qualified (`Project (Label): coin/coin`) to stay globally unique — the
// generator asserts uniqueness below.
const demosDir = join(rootDir, 'scenes/demos');
const DEMO_CATEGORY_LABELS = { '2d': '2D', '3d': '3D', gui: 'GUI', viewport: 'Viewport' };
function demoProjects() {
  let tops;
  try {
    tops = readdirSync(demosDir, { withFileTypes: true });
  } catch {
    return []; // No demos vendored — skip.
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
    // No project.godot vendored — fall through to the heuristics.
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
      // (project, top) is unique; the label disambiguates cross-category name
      // twins (2d/platformer vs 3d/platformer). The main scene keeps the tidy
      // name; subscenes append their project-relative path to stay unique.
      name: isMain
        ? `${humanizeProject(project)} (${label})`
        : `${humanizeProject(project)} (${label}): ${stem}`,
      file: `${root}/${rel}`,
      category: `Godot Demos - ${label}`,
      root,
    };
  });
});

// Vendored open-source Godot *games* (scenes/games/<dir>/) — the "proper
// games" corpus (scripts/vendor-godot-games.mjs). Same per-project res://
// scheme as the demos: copy-fixtures mirrors each under
// public/fixtures/games/<dir>/ and the web provider resolves res:// against
// the fixture's `root`. Editor scenes under addons/ are kept on disk (so refs
// resolve) but are NOT listed as selectable fixtures — they would flood the
// selector with engine-plugin UI rather than game content.
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
    return []; // No games vendored — skip.
  }
}
const gameFixtures = gameDirs().flatMap(dir => {
  const root = `games/${dir}`;
  const label = GAME_LABELS[dir] ?? humanizeProject(dir);
  const projDir = join(gamesDir, dir);
  const scenes = walkTscn(projDir)
    // Exclude engine-plugin editor scenes at any depth (res://addons/** and
    // any nested addons/ folder), not just the project-root addons/ dir.
    .filter(rel => !/(^|\/)addons\//.test(rel))
    .sort();
  if (scenes.length === 0) return [];
  const mainScene = demoMainScene(projDir);
  return scenes.map(rel => {
    const isMain = rel === mainScene;
    const stem = rel.replace(/\.tscn$/, '');
    return {
      // The main scene keeps the tidy game label; subscenes append their
      // project-relative path to stay globally unique (asserted below).
      name: isMain ? label : `${label}: ${stem}`,
      file: `${root}/${rel}`,
      category: `Games - ${label}`,
      root,
    };
  });
});

// The optional ld-58 corpus (scenes/ld58/) — a repo-external project vendored on
// demand (`pnpm vendor:ld58`), not committed. Same split as the games corpus: on
// a fresh clone ld58Files is empty and this manifest is written to a SEPARATE,
// gitignored file that fixturesAll.ts merges via import.meta.glob when present.
// Its scenes' res:// deps are mirrored under public/fixtures/ by copy-fixtures.
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
  ...exampleFiles.map(file => ({
    name: generateName(file),
    file,
    category: 'Examples - Complex Scenes',
  })),
  ...isometricFiles.map(file => ({
    name: generateName(file.split('/').pop().replace(/_/g, '-')),
    file,
    category: 'Examples - Isometric Dungeon',
  })),
  ...demoFixtures,
];

// Fixture names must be unique: the showcase recorder and scene selector both
// resolve a fixture by name (first match), so a duplicate would silently load
// the wrong scene. Fail the generation instead of producing an ambiguous
// manifest. Games and the optional ld-58 corpus are written to separate files
// (below) but share the name space at runtime, so check collisions across ALL
// sets here.
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

// Group fixtures by category, preserving first-seen category order and each
// category's declaration order. Returns the sorted list plus the category set
// (for the count in the log).
function groupByCategory(items) {
  const categories = [...new Set(items.map(f => f.category))];
  return { categories, sorted: categories.flatMap(cat => items.filter(f => f.category === cat)) };
}

const { categories, sorted: sortedFixtures } = groupByCategory(fixtures);

// Generate TypeScript file
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
 * Optional vendored corpora (games, ld-58) are fetched on demand, not
 * committed, so each manifest goes to a SEPARATE, gitignored file that
 * fixturesAll.ts merges via one wildcard import.meta.glob when present. Every
 * manifest exports the SAME conventional `corpusFixtures` name — that is what
 * lets the consumer stay a single glob with no per-corpus code; a new corpus
 * only adds a call below. On a fresh clone the corpus is absent; any stale
 * manifest is removed so the committed state stays corpus-free.
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
