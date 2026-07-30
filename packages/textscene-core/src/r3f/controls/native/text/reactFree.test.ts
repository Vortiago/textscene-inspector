/**
 * The text engine's pure layer — `textLayout.ts` and `measurer.ts` — must stay
 * React/THREE-free: the Control rect solver (`../controlRectSolver.ts`)
 * imports `measureText` directly, and `../reactFree.test.ts` already asserts
 * the solver's OWN closure stays framework-free, which would be defeated if
 * the text engine it calls into pulled a framework in one level down.
 * Mirrors that guard's shape exactly (see its own header comment for why
 * type-only imports — `measurer.ts`'s `import type { TextMeasurer }` from the
 * solver registry — are correctly skipped rather than pulling that module's
 * whole closure in).
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../r3f/controls/native/text

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
