/**
 * Guards against fixture-list drift: every file referenced in
 * src/test/integration/fixtures.ts must exist in the repo scenes/ tree.
 *
 * Resolution mirrors src/test/integration/setupWorkspace.ts, which mirrors
 * scenes/fixtures/ (the corpus's res:// root) into .test-workspace/fixtures/ —
 * so a referenced file is loadable iff it exists under that root.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtures } from './test/integration/fixtures';

// This file lives at apps/textscene-vscode/src/ -> repo root is 3 levels up.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const scenesRoot = join(repoRoot, 'scenes');

describe('integration fixture list', () => {
  it('references at least one fixture', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it('contains no duplicate files', () => {
    const files = fixtures.map((fixture) => fixture.file);
    expect(new Set(files).size).toBe(files.length);
  });

  for (const fixture of fixtures) {
    it(`"${fixture.name}" (${fixture.file}) exists in the scenes/ tree`, () => {
      expect(
        existsSync(join(scenesRoot, 'fixtures', fixture.file)),
        `${fixture.file} not found in scenes/fixtures/ — ` +
          'update src/test/integration/fixtures.ts or restore the scene file'
      ).toBe(true);
    });
  }
});
