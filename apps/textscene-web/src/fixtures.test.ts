// @vitest-environment node

/**
 * Guards the generated fixture manifest against scenes/ both ways: an entry with no
 * scene, and a committed scene with no entry. The vendored corpora (games, ld-58)
 * have their own gitignored manifests, which fixturesAll.ts merges, so they are out
 * of scope.
 */

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, getFixturesByCategory } from './fixtures';
import { DEMO_CATEGORY_LABELS } from '../../../scripts/generate-fixtures/demoCategories.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenesRoot = join(__dirname, '../../../scenes');
const sourceRoots = [join(scenesRoot, 'fixtures'), join(scenesRoot, 'isometric')];

function fixtureExistsOnDisk(file: string): boolean {
  // demos/<top>/<project>/… entries mirror scenes/demos/ one to one, not flattened.
  if (file.startsWith('demos/')) return existsSync(join(scenesRoot, file));
  return sourceRoots.some((root) => existsSync(join(root, file)));
}

// Taken from the generator, never re-typed, so a new category reaches this walk
// and the completeness check never reports clean over a corpus it skipped.
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
    return []; // Not vendored, so the manifest carries nothing for it either.
  }
  return entries.flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return scenesDeep(join(dir, entry.name), rel);
    return entry.name.endsWith('.tscn') ? [rel] : [];
  });
}

/**
 * Every committed scene the generator lists, spelled as generate-fixtures.js spells
 * a `file`: a basename for scenes/fixtures, a res://-relative path for
 * scenes/isometric, and `demos/<top>/<project>/…` under each demo category.
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
    ...scenesDeep(join(scenesRoot, 'isometric'), ''),
    ...demos,
  ];
}

/** Committed scenes absent from a manifest. */
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

    // A non-empty list means fixtures.ts and scenes/ disagree. Re-run
    // `pnpm generate:fixtures` rather than hand-editing the manifest.
    expect(missing).toEqual([]);
  });

  it('lists every committed scene in the source tree', () => {
    // The other direction catches an added scene: a new fixture in scenes/fixtures
    // without `pnpm generate:fixtures`, whose ?fixture= deep link falls back.
    expect(unlisted(fixtures.map((fixture) => fixture.file))).toEqual([]);
  });

  it('would report a scene the manifest had drifted away from', () => {
    // The guard above passes on a correct manifest whether or not it works, so
    // this proves it fails on a missing entry.
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
