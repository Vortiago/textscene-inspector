/**
 * Keeps the scene free of React and three.js, so it exists before any view and a page with no
 * React can hold one.
 */

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bareSpecifiers, FRAMEWORK_BARE_RE, tsxFiles, walkImportClosure } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

describe('the scene module', () => {
  const closure = walkImportClosure(resolve(here, 'openScene.ts'), {
    exclude: (file) => file.endsWith('.test.ts') || file.endsWith('.testkit.ts'),
    relativeTo: repoRoot,
  });

  it('resolves every import it reaches', () => {
    expect(closure.unresolved).toEqual([]);
  });

  it('reaches no render component', () => {
    expect(tsxFiles(closure)).toEqual([]);
  });

  it('value-imports no React and no three.js', () => {
    expect(
      bareSpecifiers(closure).filter((specifier) => FRAMEWORK_BARE_RE.some((re) => re.test(specifier)))
    ).toEqual([]);
  });
});
