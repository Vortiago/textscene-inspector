/**
 * Where the scaffold writes, and how it gives up. Resolved once so a module's
 * own depth never enters the calculation.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CORE_SRC = join(REPO_ROOT, 'packages/textscene-core/src');

export function fail(message) {
  console.error(`[new-node-slice] ${message}`);
  process.exit(1);
}
