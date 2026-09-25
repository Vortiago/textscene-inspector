/**
 * The monorepo root, found by walking up to `pnpm-workspace.yaml`, as `parser/testing/parserKit.ts`
 * does in TypeScript. A count of `..` from `import.meta.url` breaks silently when a module moves:
 * every check stays green, and `--update` writes goldens into the wrong directory.
 */

import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walks up from `from` (default: this file) until a directory holds `pnpm-workspace.yaml`. Throws
 * rather than fall back to `process.cwd()`, since a caller would then write to a wrong root.
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
