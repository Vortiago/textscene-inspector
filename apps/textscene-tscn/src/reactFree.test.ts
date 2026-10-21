/**
 * Keeps the @textscene/tscn entry free of React, three.js and Node built-ins, since it runs in a
 * browser. It walks the value-import closure of `src/index.ts` into core's `src/`, which core's own
 * guards do not cover. Type-only imports are skipped: the bundler erases them.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
  NODE_BUILTIN_RE,
} from '@textscene/dev-kit';

const srcDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(srcDir, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

describe('tscn-package React-free boundary', () => {
  const closure = walkImportClosure(resolve(srcDir, 'index.ts'), {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts'),
    relativeTo: repoRoot,
  });

  it('walker resolves every workspace import (guard stays exhaustive)', () => {
    // A closure collapsed to the entry file passes every emptiness check here.
    expect(closure.files.size).toBeGreaterThan(100);
    expect(closure.unresolved).toEqual([]);
  });

  it('entry closure reaches no .tsx render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('entry closure value-imports no react, three.js or Node built-in', () => {
    expect(
      bareSpecifiers(closure).filter((specifier) =>
        [...FRAMEWORK_BARE_RE, NODE_BUILTIN_RE].some((re) => re.test(specifier))
      )
    ).toEqual([]);
  });
});
