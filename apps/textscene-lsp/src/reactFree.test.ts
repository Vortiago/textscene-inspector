/**
 * Keeps the language server, a plain Node bundle, free of React and three.js. It walks
 * the value-import closure of `src/server.ts` into core's `src/`, since core's own guard
 * covers only `linter/index.ts` and `languageFeatures/index.ts` and cannot see a root-barrel
 * import added here. Type-only imports are skipped: the bundler erases them.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url)); // .../apps/textscene-lsp/src
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

describe('lsp-app React-free boundary', () => {
  const closure = walkImportClosure(resolve(here, 'server.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts'),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    // A closure collapsed to the entry file passes every emptiness check here, so
    // the floor catches a walker that stopped following.
    expect(closure.files.size).toBeGreaterThan(400);
    expect(closure.unresolved).toEqual([]);
  });

  it('server closure reaches no .tsx render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('server closure value-imports no react/react-dom/@react-three/three', () => {
    expect(bareSpecifiers(closure).filter((s) => FRAMEWORK_BARE_RE.some((re) => re.test(s)))).toEqual([]);
  });
});
