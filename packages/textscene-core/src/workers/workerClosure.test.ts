import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bareSpecifiers, FRAMEWORK_BARE_RE, tsxFiles, walkImportClosure } from '@textscene/dev-kit';

const here = dirname(fileURLToPath(import.meta.url));
const workerEntryClosure = walkImportClosure(resolve(here, 'workerScript.ts'));

describe('worker import closure', () => {
  it('resolves every workspace import, so the walk is exhaustive', () => {
    expect(workerEntryClosure.unresolved).toEqual([]);
  });

  it('walks past the script into the jobs', () => {
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
