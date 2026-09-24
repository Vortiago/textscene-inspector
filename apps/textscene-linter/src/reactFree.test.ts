/**
 * Keeps the linter CLI, a plain Node bundle, free of React and three.js. It walks
 * the value-import closure of `src/cli.ts` into core's `src/`, since core's own
 * guard covers only `linter/index.ts` and cannot see a root-barrel import added
 * here. Type-only imports are skipped: the bundler erases them.
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
    // A closure collapsed to the entry file passes every emptiness check here, so
    // the floor catches a walker that stopped following. It is inline because core
    // publishes no test-helper subpath and this app cannot deep-import past its
    // exports map.
    expect(closure.files.size).toBeGreaterThan(400);
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
