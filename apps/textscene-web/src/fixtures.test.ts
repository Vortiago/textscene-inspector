// @vitest-environment node

/**
 * Guards the generated fixture manifest against declared-but-missing scene files.
 *
 * Mirrors the path mapping used by scripts/copy-fixtures.js (and the root
 * scripts/generate-fixtures.js): scenes/fixtures/*.tscn and scenes/examples/*.tscn
 * are copied FLAT into public/fixtures/ (entry `file` is a basename), while
 * scenes/isometric/** is mirrored recursively (entry `file` is a res://-relative
 * path) and scenes/demos/** is mirrored under public/fixtures/demos/ (entry
 * `file` starts with 'demos/'). A manifest entry is therefore valid iff its
 * `file` resolves under one of those source roots. Optional vendored corpora
 * (games, ld-58) live in separate gitignored manifests merged by fixturesAll.ts
 * and are out of this guard's scope — the committed fixtures.ts never carries
 * their entries.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtures, getFixturesByCategory } from './fixtures';

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
