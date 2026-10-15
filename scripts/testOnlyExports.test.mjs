/**
 * Keeps each module of `@textscene/core` testable through its interface: a value export that only
 * tests import widens the interface for the tests alone. The scan runs over the real source tree,
 * and the cases below pin how it reads imports, re-exports and entry points.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findRepoRoot } from './repoRoot.mjs';
import { entryPointsOf, isTestFile, readSourceTree, testOnlyExports } from './testOnlyExports.mjs';

const CORE = resolve(findRepoRoot(), 'packages/textscene-core');

/** The value exports kept although only tests import them, each with the reason a test needs it. */
const KEPT = [
  // A three.js upgrade that adds a texture slot or renames its USE_ define fails these tests.
  'r3f/materialProgramInputs.ts#NOT_BOUND_TEXTURE_SLOTS',
  'r3f/materialProgramInputs.ts#TEXTURE_SLOT_GATES',
  // The builds and the cache are module state, so each test starts from the one reset that aborts
  // the builds in flight and clears the cache.
  'resources/textures/proceduralBuilds.ts#resetProceduralTextures',
];

function scan(files, entryPoints = []) {
  return testOnlyExports(new Map(Object.entries(files)), entryPoints);
}

describe('testOnlyExports over @textscene/core', () => {
  it('finds no value export that only tests import, beyond the kept ones', () => {
    const packageJson = JSON.parse(readFileSync(resolve(CORE, 'package.json'), 'utf8'));
    const found = testOnlyExports(readSourceTree(resolve(CORE, 'src')), entryPointsOf(packageJson, './src'));

    expect(found).toEqual(KEPT);
  });
});

describe('testOnlyExports', () => {
  it('reports a value export that only a test imports', () => {
    const found = scan({
      'a.ts': 'export const inner = 1;',
      'a.test.ts': "import { inner } from './a';",
    });

    expect(found).toEqual(['a.ts#inner']);
  });

  it('passes an export that a production file imports', () => {
    const found = scan({
      'a.ts': 'export function step() {}',
      'b.ts': "import { step } from './a.js';\nstep();",
    });

    expect(found).toEqual([]);
  });

  it('counts a use inside the declaring file as no import (edge case)', () => {
    const found = scan({ 'a.ts': 'export const inner = 1;\nconsole.log(inner);' });

    expect(found).toEqual(['a.ts#inner']);
  });

  it('follows a barrel re-export to the declaration', () => {
    const found = scan({
      'slice/decode.ts': 'export function decode() {}',
      'slice/index.ts': "export { decode } from './decode';",
      'user.ts': "import { decode } from './slice';",
    });

    expect(found).toEqual([]);
  });

  it('reports a re-export that no production file goes through', () => {
    const found = scan({
      'slice/decode.ts': 'export function decode() {}',
      'slice/index.ts': "export { decode } from './decode';",
      'user.ts': "import { decode } from './slice/decode';",
    });

    expect(found).toEqual(['slice/index.ts#decode']);
  });

  it('counts what an entry point forwards as the package interface', () => {
    const found = scan(
      {
        'index.ts': "export * from './api';",
        'api.ts': 'export const publicValue = 1;',
      },
      ['index.ts']
    );

    expect(found).toEqual([]);
  });

  it('counts a bare dynamic import as a use of every export', () => {
    const found = scan({
      'lazy.ts': 'export function Panel() {}\nexport function Other() {}',
      'host.ts': "const lazy = () => import('./lazy.js');",
    });

    expect(found).toEqual([]);
  });

  it("counts only the names a dynamic import's callback reads", () => {
    const found = scan({
      'lazy.ts': 'export function Panel() {}\nexport function Other() {}',
      'host.ts': "const lazy = () => import('./lazy.js').then((m) => ({ default: m.Panel }));",
    });

    expect(found).toEqual(['lazy.ts#Other']);
  });

  it('counts every export when the callback passes the module on (edge case)', () => {
    const found = scan({
      'lazy.ts': 'export function Panel() {}\nexport function Other() {}',
      'host.ts': "const lazy = () => import('./lazy.js').then((m) => keep(m));",
    });

    expect(found).toEqual([]);
  });

  it('skips an import from a package, which no file in the tree answers (error path)', () => {
    const found = scan({
      'a.ts': 'export const inner = 1;',
      'b.ts': "import { inner } from 'some-package';",
    });

    expect(found).toEqual(['a.ts#inner']);
  });

  it('reports a production re-export of a test kit that only tests import (edge case)', () => {
    const found = scan({
      'a.ts': "export { helper } from './testing/kit';",
      'testing/kit.ts': 'export function helper() {}',
      'a.test.ts': "import { helper } from './a';",
    });

    expect(found).toEqual(['a.ts#helper']);
  });

  it('leaves type exports out', () => {
    const found = scan({ 'a.ts': 'export interface Shape {}\nexport type Id = string;' });

    expect(found).toEqual([]);
  });
});

describe('isTestFile', () => {
  it.each(['a.test.ts', 'b.spec.tsx', 'c.testkit.ts', 'linter/testing/kit.ts'])(
    'treats %s as a test file',
    (path) => {
      expect(isTestFile(path)).toBe(true);
    }
  );

  it.each(['a.ts', 'testingTools.ts', 'contest.ts'])('treats %s as production', (path) => {
    expect(isTestFile(path)).toBe(false);
  });
});
