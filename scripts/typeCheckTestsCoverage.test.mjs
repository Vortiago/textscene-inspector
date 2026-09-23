/**
 * Asserts that every package with tests defines `type-check:tests`: `pnpm -r <script>` skips a
 * package without the script and says nothing, so the package would drop out of the gate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every workspace package directory, from the two workspace globs. */
function workspacePackages() {
  return ['packages', 'apps'].flatMap((group) =>
    readdirSync(join(REPO_ROOT, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(group, entry.name))
      .filter((rel) => existsSync(join(REPO_ROOT, rel, 'package.json')))
  );
}

const scriptsOf = (rel) =>
  JSON.parse(readFileSync(join(REPO_ROOT, rel, 'package.json'), 'utf8')).scripts ?? {};

/** Packages shipping at least one test file, so a type-check of them means something. */
function hasTests(rel) {
  const walk = (dir) => {
    if (!existsSync(dir)) return false;
    return readdirSync(dir, { withFileTypes: true }).some((entry) => {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name !== 'node_modules' && walk(child);
      return /\.test\.(ts|tsx|mts)$/.test(entry.name);
    });
  };
  return walk(join(REPO_ROOT, rel, 'src'));
}

describe('the recursive type-check:tests gate', () => {
  const packages = workspacePackages().filter(hasTests);

  it('has subjects, so the sweep below cannot pass by finding none', () => {
    expect(packages.length).toBeGreaterThan(3);
  });

  it('is defined by every package that ships tests', () => {
    const missing = packages.filter((rel) => !scriptsOf(rel)['type-check:tests']);
    expect(
      missing,
      'pnpm -r skips a package that does not define the script, without a diagnostic, ' +
        'so these packages are outside `pnpm validate` while looking covered'
    ).toEqual([]);
  });
});
