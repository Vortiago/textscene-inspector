/**
 * A worker bundle carries only the jobs: the worker entry's closure never reaches
 * three, react or a `.tsx`. A leak would ship the renderer into every
 * worker and could touch the DOM, which a worker does not have.
 */
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bareSpecifiers, FRAMEWORK_BARE_RE, tsxFiles, walkImportClosure } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));
// The subpath entry a host's worker script imports, `@textscene/core/worker`.
const workerEntryClosure = walkImportClosure(resolve(here, '../worker.ts'));

describe('worker import closure', () => {
  it('resolves every workspace import, so the walk is exhaustive', () => {
    expect(workerEntryClosure.unresolved).toEqual([]);
  });

  it('walks past the entry file into the jobs', () => {
    expect(workerEntryClosure.files.has(resolve(here, 'jobs.ts'))).toBe(true);
  });

  it('reaches no .tsx component', () => {
    expect(tsxFiles(workerEntryClosure)).toEqual([]);
  });

  it('value-imports no react or three', () => {
    const framework = bareSpecifiers(workerEntryClosure).filter((s) =>
      FRAMEWORK_BARE_RE.some((re) => re.test(s))
    );
    expect(framework).toEqual([]);
  });
});
