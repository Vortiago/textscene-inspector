#!/usr/bin/env node
/**
 * Auto-generate fixtures.ts from filesystem
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
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
    filename.startsWith('unit-mesh')
  ) {
    return 'Unit - Primitive Meshes';
  }
  if (filename.startsWith('unit-csg')) return 'Unit - CSG Primitives';
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
    filename.startsWith('unit-canvas-layer')
  ) {
    return 'Unit - 2D UI Controls';
  }
  // 2D canvas (non-UI) nodes rendered in the R3F viewport (Node2D/Sprite2D/Camera2D/TileMap).
  if (
    filename.startsWith('unit-node2d') ||
    filename.startsWith('unit-sprite2d') ||
    filename.startsWith('unit-camera2d') ||
    filename.startsWith('unit-tile') ||
    filename.startsWith('unit-2d')
  ) {
    return 'Unit - 2D Canvas';
  }
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
// Only each project's MAIN scene (what Godot itself would run, declared in
// project.godot) is listed — one tidy entry per demo. Subscenes stay in the
// mirror for res:// resolution and remain reachable via ?fixture= deep links.
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
  const mainScene = demoMainScene(join(demosDir, top, project));
  if (!mainScene) return [];
  return [
    {
      // (project, top) is unique; the label disambiguates cross-category
      // name twins (2d/platformer vs 3d/platformer).
      name: `${humanizeProject(project)} (${label})`,
      file: `${root}/${mainScene}`,
      category: `Godot Demos - ${label}`,
      root,
    },
  ];
});

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
  ...ld58Files.map(file => ({
    // ld-58 scenes keep Godot's CamelCase / snake_case basenames; split those
    // into words so the selector shows "Inspector Crawford", not "InspectorCrawford".
    name: generateName(
      file
        .split('/')
        .pop()
        .replace(/_/g, '-')
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    ),
    file,
    category: 'Examples - ld-58 Scenes',
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
// the wrong scene. Fail the generation instead of producing an ambiguous manifest.
const seenNames = new Map();
for (const fixture of fixtures) {
  const prior = seenNames.get(fixture.name);
  if (prior) {
    throw new Error(
      `Duplicate fixture name "${fixture.name}": "${prior}" and "${fixture.file}". ` +
        `Rename one of the scenes so every fixture name is unique.`
    );
  }
  seenNames.set(fixture.name, fixture.file);
}

// Group by category
const categories = [...new Set(fixtures.map(f => f.category))];
const sortedFixtures = [];
categories.forEach(cat => {
  sortedFixtures.push(...fixtures.filter(f => f.category === cat));
});

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
