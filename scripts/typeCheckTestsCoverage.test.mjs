/**
 * Asserts that every package with tests defines `type-check:tests`: `pnpm -r <script>` skips a
 * package without the script and says nothing, so the package would drop out of the gate.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';
import { workspacePackages } from './workspace.mjs';

const scriptsOf = (dir) => JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).scripts ?? {};

/** Packages shipping at least one test file, so a type-check of them means something. */
function hasTests(dir) {
  const walk = (folder) => {
    if (!existsSync(folder)) return false;
    return readdirSync(folder, { withFileTypes: true }).some((entry) => {
      const child = join(folder, entry.name);
      if (entry.isDirectory()) return entry.name !== 'node_modules' && walk(child);
      return /\.test\.(ts|tsx|mts)$/.test(entry.name);
    });
  };
  return walk(join(dir, 'src'));
}

describe('the recursive type-check:tests gate', () => {
  const packages = workspacePackages().filter(hasTests);

  it('has subjects, so the sweep below cannot pass by finding none', () => {
    expect(packages.length).toBeGreaterThan(3);
  });

  it('is defined by every package that ships tests', () => {
    const missing = packages
      .filter((dir) => !scriptsOf(dir)['type-check:tests'])
      .map((dir) => relative(REPO_ROOT, dir));
    expect(
      missing,
      'pnpm -r skips a package that does not define the script, without a diagnostic, ' +
        'so these packages are outside `pnpm validate` while looking covered'
    ).toEqual([]);
  });
});
