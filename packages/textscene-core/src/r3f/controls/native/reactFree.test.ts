/**
 * The Control rect solver is pure TS: no React, no THREE, anywhere in
 * `native/{rect,solveTree,nativeTheme,solverRegistry,controlRectSolver,solveHandoff}.ts`.
 */
// Six separate entries: most references between them are `import type`, which
// the walker skips, so a closure rooted at one file never reaches `nativeTheme.ts`.
// The union of the six closures is what ships.
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));

const entries = ['rect.ts', 'solveTree.ts', 'nativeTheme.ts', 'solverRegistry.ts', 'controlRectSolver.ts', 'solveHandoff.ts'];

const closures = entries.map((f) => walkImportClosure(resolve(here, f), { relativeTo: here }));

describe('native Control rect solver stays React/THREE-free', () => {
  it('every entry resolves its full workspace closure (guard stays exhaustive)', () => {
    for (const closure of closures) {
      expect(closure.unresolved).toEqual([]);
    }
  });

  it('reaches no .tsx render component from any of the six modules', () => {
    for (const closure of closures) {
      expect(tsxFiles(closure)).toEqual([]);
    }
  });

  it('value-imports no react/react-dom/@react-three/three from any of the six modules', () => {
    for (const closure of closures) {
      expect(bareSpecifiers(closure).filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual([]);
    }
  });
});
