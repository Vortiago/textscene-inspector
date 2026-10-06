/**
 * Keeps the language-feature engine free of React and three.js, so the VS Code
 * extension host and the `tscn-lsp` server, both plain Node bundles, can import it.
 * It walks the value-import closure of `index.ts`, the module a host reaches first.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../packages/textscene-core/src/languageFeatures
const repoRoot = resolve(here, '../../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

describe('languageFeatures React-free boundary', () => {
  const closure = walkImportClosure(resolve(here, 'index.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts') || file.endsWith('.testkit.ts'),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    expect(closure.files.size).toBeGreaterThan(10);
    expect(closure.unresolved).toEqual([]);
  });

  it('reaches no .tsx render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('value-imports no react/react-dom/@react-three/three', () => {
    expect(
      bareSpecifiers(closure).filter((specifier) => FRAMEWORK_BARE_RE.some((re) => re.test(specifier)))
    ).toEqual([]);
  });
});
