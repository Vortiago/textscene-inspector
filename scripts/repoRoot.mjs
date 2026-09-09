/**
 * The monorepo root, found by walking up to `pnpm-workspace.yaml`.
 *
 * Depth-independent on purpose. Counting `..` from a module's own
 * `import.meta.url` is correct exactly until the module moves, and the 150-200
 * LOC ceiling keeps moving them: `scripts/visual/run.mjs` derived its baseline
 * directory that way and going one level down would have repointed all 145
 * goldens at a directory that does not exist — green under `node --check`,
 * eslint and vitest the whole way, and under `--update` it would have written
 * 145 PNGs into the wrong place rather than failing.
 *
 * Same technique as `parser/testing/parserKit.ts` on the TypeScript side.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk up from `from` (default: this file) until a directory holds
 * `pnpm-workspace.yaml`.
 *
 * Throws rather than falling back to `process.cwd()`: a wrong root resolves to
 * paths that simply do not exist, and a caller that then writes to them is the
 * failure this module exists to prevent.
 */
export function findRepoRoot(from = dirname(fileURLToPath(import.meta.url))) {
  let dir = from;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`repo root (pnpm-workspace.yaml) not found above ${from}`);
}

/** The repo root, resolved once at import. */
export const REPO_ROOT = findRepoRoot();
