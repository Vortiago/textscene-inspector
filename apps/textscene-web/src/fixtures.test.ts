// @vitest-environment node

/**
 * Guards the generated fixture manifest against declared-but-missing scene files.
 *
 * Mirrors the path mapping used by scripts/copy-fixtures.js (and the root
 * scripts/generate-fixtures.js): scenes/fixtures/*.tscn and scenes/examples/*.tscn
 * are copied FLAT into public/fixtures/ (entry `file` is a basename), while
 * scenes/ld58/** is mirrored recursively (entry `file` is a res://-relative path).
 * A manifest entry is therefore valid iff its `file` resolves under one of those
 * three source roots.
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
  join(scenesRoot, 'ld58'),
];

function fixtureExistsOnDisk(file: string): boolean {
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
