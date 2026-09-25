/** Where the scaffold writes, resolved once so a module's own depth never enters it, and how it fails. */

import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';

export { REPO_ROOT };
export const CORE_SRC = join(REPO_ROOT, 'packages/textscene-core/src');

export function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}
