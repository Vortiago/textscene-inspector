/**
 * Pins the entry-point gate: the real manifests of the four published packages all declare the
 * root export a bundler guesses, and the fixture cases name each way a manifest can fail it.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { entryPointProblems } from './check-package-entry.mjs';
import { RELEASE_NPM_DIRECTORIES } from './ci/releaseVersion.mjs';
import { findRepoRoot } from './repoRoot.mjs';

const ROOT = findRepoRoot();

/** Writes one manifest into a fresh fixture package and reads the gate's verdict on it. */
function scanFixture(manifest) {
  const root = mkdtempSync(join(tmpdir(), 'package-entry-'));
  mkdirSync(join(root, 'pkg'), { recursive: true });
  writeFileSync(join(root, 'pkg', 'package.json'), JSON.stringify(manifest));
  try {
    return entryPointProblems(root, ['pkg']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const GUESSABLE_MANIFEST = {
  name: 'pkg',
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
  files: ['dist', '!dist/*.meta.json'],
};

describe('entryPointProblems', () => {
  it('finds no problem in the four published packages', () => {
    expect(entryPointProblems(ROOT, RELEASE_NPM_DIRECTORIES)).toEqual([]);
  });

  it('finds no problem in a manifest whose entry its files cover', () => {
    expect(scanFixture(GUESSABLE_MANIFEST)).toEqual([]);
  });

  it('reports a bin-only manifest with no root export', () => {
    expect(scanFixture({ name: 'pkg', bin: { pkg: './bin/pkg.js' }, files: ['dist', 'bin'] })).toEqual([
      expect.stringContaining('exports["."] is missing'),
    ]);
  });

  it('reports an entry without its types condition', () => {
    expect(
      scanFixture({
        name: 'pkg',
        exports: { '.': { import: './dist/index.js' } },
        files: ['dist', '!dist/*.meta.json'],
      })
    ).toEqual([expect.stringContaining('names no types condition')]);
  });

  it('reports an entry without an import or default condition', () => {
    expect(scanFixture({ ...GUESSABLE_MANIFEST, exports: { '.': { types: './dist/index.d.ts' } } })).toEqual([
      expect.stringContaining('names no import condition'),
    ]);
  });

  it('reports an entry file the files list drops', () => {
    expect(
      scanFixture({
        ...GUESSABLE_MANIFEST,
        main: './lib/index.js',
        types: './lib/index.d.ts',
        files: ['dist', 'bin'],
      })
    ).toEqual([
      'pkg/package.json: ./lib/index.js is outside files, so the tarball drops it.',
      'pkg/package.json: ./lib/index.d.ts is outside files, so the tarball drops it.',
    ]);
  });

  it('answers nothing for a private package, which ships no tarball', () => {
    expect(scanFixture({ ...GUESSABLE_MANIFEST, private: true, bin: undefined, files: undefined })).toEqual(
      []
    );
  });
});
