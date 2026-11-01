/**
 * Keeps the language server's entries, plain Node bundles, free of React and three.js: the server
 * the bin runs and the library entry the manifest publishes. It walks each entry's value-import
 * closure into core's `src/`, since core's own guard covers only `linter/index.ts` and
 * `languageFeatures/index.ts` and cannot see a root-barrel import added here. The walk skips
 * type-only imports: the bundler erases them.
 */

import { describe, it, expect } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkImportClosure, bareSpecifiers, tsxFiles, FRAMEWORK_BARE_RE } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const coreSrc = resolve(repoRoot, 'packages/textscene-core/src');

/** The bin's entry and the manifest's entry, by their own names. */
const ENTRIES = {
  'server.ts': resolve(here, 'server.ts'),
  'index.ts': resolve(here, 'index.ts'),
} as const;

const walk = (entry: string) =>
  walkImportClosure(entry, {
    packageAliases: { '@textscene/core': coreSrc },
    exclude: (file) => file.endsWith('.test.ts'),
    relativeTo: repoRoot,
  });

const closures = Object.entries(ENTRIES).map(([name, entry]) => [name, walk(entry)] as const);

describe('lsp React-free boundary', () => {
  it.each(closures)('%s closure reaches no .tsx render component', (_name, closure) => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it.each(closures)('%s closure value-imports no react/react-dom/@react-three/three', (_name, closure) => {
    expect(
      bareSpecifiers(closure).filter((specifier) => FRAMEWORK_BARE_RE.some((re) => re.test(specifier)))
    ).toEqual([]);
  });

  it('walker resolves every workspace import of every entry (guard stays exhaustive)', () => {
    // A closure collapsed to the entry file passes every emptiness check here, so the
    // floor catches a walker that stopped following.
    for (const [name, closure] of closures) {
      expect(closure.files.size, name).toBeGreaterThan(400);
      expect(closure.unresolved, name).toEqual([]);
    }
  });
});
