/**
 * Test-only: finds every slice `index.ts` that registers a resource slice, for the
 * guards that walk the slice folders. `testing/` is outside the package build, so
 * its `node:fs` import never reaches production code.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REGISTER_RE = /\bregister(Generic)?ResourceSlice\s*\(/;

/** Every registering `index.ts` under `dir`, at any depth. */
export function findRegisteringIndexes(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRegisteringIndexes(full));
    else if (entry.name === 'index.ts' && REGISTER_RE.test(readFileSync(full, 'utf8'))) {
      out.push(full);
    }
  }
  return out;
}
