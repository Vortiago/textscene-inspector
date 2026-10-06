/** The git reads that the pre-push hook and `pnpm check` share. */

import { execFileSync } from 'node:child_process';

/** The trimmed stdout of `git <args>`. A failed command throws, and its stderr stays hidden. */
export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
