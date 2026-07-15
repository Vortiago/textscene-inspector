/**
 * React-free boundary guard for the linter CLI app.
 *
 * `apps/textscene-linter` must stay React- and three.js-free: it is a plain
 * Node CLI and esbuild bundles it as such (`platform: 'node'`). The guard in
 * `@textscene/core` (`linter/reactFree.test.ts`) only covers `linter/index.ts`
 * — it cannot see an accidental root-barrel `@textscene/core` import added at
 * the app level, because the app layer is outside core's test scope.
 *
 * This test walks the static *value*-import closure of `src/cli.ts` (type-only
 * imports are skipped — the bundler erases them), following relative imports
 * and `@textscene/core/*` subpaths into the core package's `src/`. It asserts:
 *
 *   - No `.tsx` render component is reachable.
 *   - No react / react-dom / @react-three / three bare specifier is value-imported.
 *   - Every workspace import resolves (walker stays exhaustive).
 *
 * Modeled on `apps/textscene-vscode/src/webExtensionSafe.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
} from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../apps/textscene-linter/src
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

describe('linter-app React-free boundary', () => {
  const closure = walkImportClosure(resolve(here, 'cli.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts'),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(closure.unresolved).toEqual([]);
  });

  it('cli closure reaches no .tsx render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('cli closure value-imports no react/react-dom/@react-three/three', () => {
    expect(bareSpecifiers(closure).filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual(
      []
    );
  });
});
