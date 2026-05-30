#!/usr/bin/env node
/**
 * Auto-generate fixtures.ts from filesystem
 */

import { readdirSync, writeFileSync } from 'fs';
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
const ld58Dir = join(rootDir, 'scenes/ld58');
let ld58Files = [];
try {
  ld58Files = readdirSync(ld58Dir).filter(f => f.endsWith('.tscn')).sort();
} catch {
  // No ld58 directory — skip.
}

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
    name: generateName(file),
    file,
    category: 'Examples - ld-58 Scenes',
  })),
];

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
