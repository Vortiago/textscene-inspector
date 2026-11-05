/** Vitest's global setup: dist is current before the tests that read it and the e2e tests that rebuild it. */
import { join } from 'node:path';
import { buildCore, ensureFreshDist } from './ensureFreshDist.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';

export function setup() {
  ensureFreshDist(join(REPO_ROOT, 'packages/textscene-core'), buildCore);
}
