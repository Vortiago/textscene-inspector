/**
 * The Control rect solver is pure TS: no React, no THREE, anywhere in
 * `native/{rect,solveTree,nativeTheme,solverRegistry,controlRectSolver}.ts`.
 * Walked as five SEPARATE entries (not just `controlRectSolver.ts`) because
 * most of the cross-file references between them are `import type` — erased
 * by the bundler, and correctly skipped by the walker — so a value-import
 * closure rooted at just one file would never traverse into, say,
 * `nativeTheme.ts`, which nothing here value-imports. The union of all five
 * closures is what actually ships if any one of them is imported on its own.
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../r3f/controls/native

const entries = ['rect.ts', 'solveTree.ts', 'nativeTheme.ts', 'solverRegistry.ts', 'controlRectSolver.ts'];

const closures = entries.map((f) => walkImportClosure(resolve(here, f), { relativeTo: here }));

describe('native Control rect solver stays React/THREE-free', () => {
  it('every entry resolves its full workspace closure (guard stays exhaustive)', () => {
    for (const closure of closures) {
      expect(closure.unresolved).toEqual([]);
    }
  });

  it('reaches no .tsx render component from any of the five modules', () => {
    for (const closure of closures) {
      expect(tsxFiles(closure)).toEqual([]);
    }
  });

  it('value-imports no react/react-dom/@react-three/three from any of the five modules', () => {
    for (const closure of closures) {
      expect(bareSpecifiers(closure).filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual([]);
    }
  });
});
