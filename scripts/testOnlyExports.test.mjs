/**
 * Keeps each module of `@textscene/core` testable through its interface: a value export that only
 * tests import widens the interface for the tests alone. The scan runs over the real source tree,
 * and the cases below pin how it reads imports, re-exports and entry points.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findRepoRoot } from './repoRoot.mjs';
import {
  entryPointsOf,
  isTestFile,
  readImporters,
  readSourceTree,
  testOnlyExports,
} from './testOnlyExports.mjs';

const ROOT = findRepoRoot();
const CORE = resolve(ROOT, 'packages/textscene-core');

/** Every place outside core that imports it: the apps, the dev kit and the scripts. */
const OUTSIDE_CORE = ['apps', 'packages/textscene-dev-kit', 'scripts'].map((dir) => resolve(ROOT, dir));

/**
 * The scan of the real tree parses over 5,000 TypeScript files of core and of its importers. That is real work: it
 * took 7.5 seconds on a slow container, past vitest's 5 second default, so the case that scans it gets room.
 */
const TREE_SCAN_TIMEOUT_MS = 60_000;

/** The value exports kept although only tests import them, each with the reason a test needs it. */
const KEPT = [
  // `@react-three/test-renderer` cannot wrap a real `<Canvas>`, so a scene test mounts its contents.
  'r3f/TscnCanvas.tsx#TscnSceneContents',
  // The builds and the cache are module state, so each test starts from the one reset that aborts
  // the builds in flight and clears the cache.
  'resources/textures/proceduralBuilds.ts#resetProceduralTextures',
];

/**
 * A scan of `files`, the tree at `core/` built to `core-dist/`, with `importers` outside it and
 * `entries` as its package entry points.
 */
function scan(files, { importers = {}, entries = {} } = {}) {
  return testOnlyExports(new Map(Object.entries(files)), {
    tree: 'core',
    dist: 'core-dist',
    importers: new Map(Object.entries(importers)),
    entries: new Map(Object.entries(entries)),
  });
}

describe('testOnlyExports over @textscene/core', () => {
  it(
    'finds no value export that only tests import, beyond the kept ones',
    () => {
      const packageJson = JSON.parse(readFileSync(resolve(CORE, 'package.json'), 'utf8'));
      const found = testOnlyExports(readSourceTree(resolve(CORE, 'src')), {
        tree: 'packages/textscene-core/src',
        dist: 'packages/textscene-core/dist',
        importers: readImporters(ROOT, OUTSIDE_CORE),
        entries: entryPointsOf(packageJson, './src'),
      });

      expect(found).toEqual(KEPT);
    },
    TREE_SCAN_TIMEOUT_MS
  );
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

  it('counts what an entry point forwards once a package outside the tree imports it', () => {
    const found = scan(
      {
        'index.ts': "export * from './api';",
        'api.ts': 'export const publicValue = 1;',
      },
      {
        importers: { 'app/main.ts': "import { publicValue } from 'pkg';" },
        entries: { pkg: 'index.ts' },
      }
    );

    expect(found).toEqual([]);
  });

  it('reports an entry-point export that no package outside the tree imports', () => {
    const found = scan(
      {
        'index.ts': "export { publicValue, hidden } from './api';",
        'api.ts': 'export const publicValue = 1;\nexport const hidden = 2;',
        'api.test.ts': "import { hidden } from './api';",
      },
      {
        importers: { 'app/main.ts': "import { publicValue } from 'pkg';" },
        entries: { pkg: 'index.ts' },
      }
    );

    expect(found).toEqual(['api.ts#hidden', 'index.ts#hidden']);
  });

  it('counts a script that imports a tree file by its relative path (edge case)', () => {
    const found = scan(
      { 'sky/layers.ts': 'export function layers() {}' },
      { importers: { 'scripts/page.mjs': "import { layers } from '../core/sky/layers.ts';" } }
    );

    expect(found).toEqual([]);
  });

  it('counts an outside test that imports the package, but not one that reaches past it', () => {
    const found = scan(
      { 'index.ts': "export { a } from './a';", 'a.ts': 'export const a = 1;\nexport const b = 2;' },
      {
        importers: {
          'app/a.test.ts': "import { a } from 'pkg';",
          'scripts/b.test.mjs': "import { b } from '../core/a.ts';",
        },
        entries: { pkg: 'index.ts' },
      }
    );

    expect(found).toEqual(['a.ts#b']);
  });

  it("does not count an outside test's `typeof import('pkg')` as a use of every export (edge case)", () => {
    const found = scan(
      { 'index.ts': "export { a } from './a';", 'a.ts': 'export const a = 1;' },
      {
        importers: { 'app/a.test.ts': "type Core = typeof import('pkg');" },
        entries: { pkg: 'index.ts' },
      }
    );

    expect(found).toEqual(['a.ts#a', 'index.ts#a']);
  });

  it('counts the names a script destructures from the build of a tree file', () => {
    const found = scan(
      { 'linter/index.ts': 'export const registry = 1;\nexport const hidden = 2;' },
      {
        importers: {
          'scripts/load.mjs': "const { registry } = await import('../core-dist/linter/index.js');",
        },
      }
    );

    expect(found).toEqual(['linter/index.ts#hidden']);
  });

  it('counts no export for an import a script makes only for its side effects (edge case)', () => {
    const found = scan(
      { 'parser.ts': 'export const parse = 1;' },
      { importers: { 'scripts/load.mjs': "await import('../core-dist/parser.js');" } }
    );

    expect(found).toEqual(['parser.ts#parse']);
  });

  it("ignores an outside importer's relative import that leaves the tree (error path)", () => {
    const found = scan(
      { 'a.ts': 'export const inner = 1;' },
      { importers: { 'scripts/page.mjs': "import { inner } from './a.ts';" } }
    );

    expect(found).toEqual(['a.ts#inner']);
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
  it.each(['a.test.ts', 'b.spec.tsx', 'c.testkit.ts', 'd.test.mjs', 'linter/testing/kit.ts'])(
    'treats %s as a test file',
    (path) => {
      expect(isTestFile(path)).toBe(true);
    }
  );

  it.each(['a.ts', 'testingTools.ts', 'contest.ts', 'run.mjs'])('treats %s as production', (path) => {
    expect(isTestFile(path)).toBe(false);
  });
});
