/**
 * `textLayout.ts` and `measurer.ts` stay React- and THREE-free, because the Control rect solver
 * imports `measureText` and `../reactFree.test.ts` holds the solver's own closure framework-free.
 * The guard mirrors that one, which skips type-only imports.
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));

const entries = ['textLayout.ts', 'measurer.ts'];

const closures = entries.map((f) => walkImportClosure(resolve(here, f), { relativeTo: here }));

describe('native text engine stays React/THREE-free', () => {
  it('every entry resolves its full workspace closure (guard stays exhaustive)', () => {
    for (const closure of closures) {
      expect(closure.unresolved).toEqual([]);
    }
  });

  it('reaches no .tsx render component from either module', () => {
    for (const closure of closures) {
      expect(tsxFiles(closure)).toEqual([]);
    }
  });

  it('value-imports no react/react-dom/@react-three/three from either module', () => {
    for (const closure of closures) {
      expect(bareSpecifiers(closure).filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual([]);
    }
  });
});
