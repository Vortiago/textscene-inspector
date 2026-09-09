/**
 * Where the scaffold writes, and how it gives up. Resolved once so a module's
 * own depth never enters the calculation.
 */

import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';

export { REPO_ROOT };
export const CORE_SRC = join(REPO_ROOT, 'packages/textscene-core/src');

export function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}
