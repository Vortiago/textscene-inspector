// @vitest-environment node

/**
 * Guards the generated fixture manifest against the source tree, BOTH ways:
 * a declared entry with no scene behind it, and a committed scene the manifest
 * never picked up.
 *
 * Mirrors the path mapping used by scripts/copy-fixtures.js (and the root
 * scripts/generate-fixtures.js): scenes/fixtures/*.tscn and scenes/examples/*.tscn
 * are copied FLAT into public/fixtures/ (entry `file` is a basename), while
 * scenes/isometric/** is mirrored recursively (entry `file` is a res://-relative
 * path) and scenes/demos/** is mirrored under public/fixtures/demos/ (entry
 * `file` starts with 'demos/'). A manifest entry is therefore valid iff its
 * `file` resolves under one of those source roots, and the manifest is complete
 * iff every committed scene under them appears. Optional vendored corpora
 * (games, ld-58) live in separate gitignored manifests merged by fixturesAll.ts
 * and are out of this guard's scope — the committed fixtures.ts never carries
 * their entries.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, getFixturesByCategory } from './fixtures';
import { DEMO_CATEGORY_LABELS } from '../../../scripts/generate-fixtures/demoCategories.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const sourceRoots = [
  join(scenesRoot, 'fixtures'),
  join(scenesRoot, 'examples'),
  join(scenesRoot, 'isometric'),
];

function fixtureExistsOnDisk(file: string): boolean {
  // demos/<top>/<project>/… entries mirror scenes/demos/ 1:1 (not flattened).
  if (file.startsWith('demos/')) return existsSync(join(scenesRoot, file));
  return sourceRoots.some((root) => existsSync(join(root, file)));
}

// Taken from the generator, never re-typed: a category it starts emitting has
// to reach this walk too, or the completeness check below reports clean over a
// corpus it never looked at.
const DEMO_TOPS = Object.keys(DEMO_CATEGORY_LABELS);

/** `.tscn` files directly in `dir`, as the manifest spells them (basenames). */
function scenesFlat(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tscn'))
    .map((entry) => entry.name);
}

/** `.tscn` files anywhere under `dir`, prefixed the way the manifest spells them. */
function scenesDeep(dir: string, prefix: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return []; // Corpus not vendored — the manifest carries nothing for it either.
  }
  return entries.flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return scenesDeep(join(dir, entry.name), rel);
    return entry.name.endsWith('.tscn') ? [rel] : [];
  });
}

/**
 * Every COMMITTED scene the generator would list, spelled as a manifest `file`.
 *
 * Mirrors generate-fixtures.js: flat basenames for scenes/fixtures and
 * scenes/examples, res://-relative paths for scenes/isometric, and
 * `demos/<top>/<project>/…` for each project directory under the four demo
 * categories. The on-demand corpora (games, ld-58) are gitignored and go to
 * separate manifests, so they are out of scope here exactly as they are above.
 */
function committedScenesOnDisk(): string[] {
  const demos = DEMO_TOPS.flatMap((top) => {
    const topDir = join(scenesRoot, 'demos', top);
    let projects;
    try {
      projects = readdirSync(topDir, { withFileTypes: true });
    } catch {
      return [];
    }
    return projects
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => scenesDeep(join(topDir, entry.name), `demos/${top}/${entry.name}`));
  });
  return [
    ...scenesFlat(join(scenesRoot, 'fixtures')),
    ...scenesFlat(join(scenesRoot, 'examples')),
    ...scenesDeep(join(scenesRoot, 'isometric'), ''),
    ...demos,
  ];
}

/** Committed scenes absent from a manifest — the direction the guard was missing. */
function unlisted(declared: Iterable<string>): string[] {
  const have = new Set(declared);
  return committedScenesOnDisk().filter((file) => !have.has(file));
}

describe('fixtures manifest', () => {
  it('declares at least one fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('references only files that exist in the source scenes/ tree', () => {
    const missing = fixtures
      .filter((fixture) => !fixtureExistsOnDisk(fixture.file))
      .map((fixture) => `${fixture.name} -> ${fixture.file}`);

    // A non-empty list means fixtures.ts drifted from scenes/. Re-run
    // `pnpm generate:fixtures` instead of hand-editing the manifest.
    expect(missing).toEqual([]);
  });

  it('lists every committed scene in the source tree', () => {
    // The other direction. Manifest -> disk catches a deleted scene; this
    // catches an ADDED one, which is the drift that actually happens: a new
    // slice's fixture lands in scenes/fixtures without `pnpm generate:fixtures`,
    // and its ?fixture= deep link silently falls back with every test green.
    expect(unlisted(fixtures.map((fixture) => fixture.file))).toEqual([]);
  });

  it('would report a scene the manifest had drifted away from', () => {
    // The guard above passes on a correct manifest whether or not it works, so
    // this is the half that proves it bites.
    const declared = fixtures.map((fixture) => fixture.file);
    const dropped = declared[0]!;
    expect(unlisted(declared.filter((file) => file !== dropped))).toEqual([dropped]);
  });

  it('has unique fixture names (selector and showcase resolve by name)', () => {
    const names = fixtures.map((fixture) => fixture.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('groups every fixture into its category via getFixturesByCategory', () => {
    const categorized = getFixturesByCategory();
    const total = [...categorized.values()].reduce((sum, group) => sum + group.length, 0);

    expect(total).toBe(fixtures.length);
    for (const [category, group] of categorized) {
      for (const fixture of group) {
        expect(fixture.category).toBe(category);
      }
    }
  });
});
