/**
 * Test-only: walks of the source tree for the guards that read it. `testing/` is
 * outside the package build, so its `node:fs` import never reaches production code.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const REGISTER_RE = /\bregister(Generic)?ResourceSlice\s*\(/;

/** Every file under `dir`, at any depth. */
export function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else out.push(full);
  }
  return out;
}

/** Every slice `index.ts` under `dir` that registers a resource slice. */
export function findRegisteringIndexes(dir: string): string[] {
  return filesUnder(dir).filter(
    (file) => basename(file) === 'index.ts' && REGISTER_RE.test(readFileSync(file, 'utf8'))
  );
}
