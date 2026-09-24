/**
 * Git plumbing shared by the vendor scripts, in one place like vendor-prune.mjs, so the vendored
 * corpora cannot diverge.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Shallow-fetches one ref (branch, tag or commit) into `dest`, with no history and no .git. */
export function fetchShallow(url, ref, dest) {
  mkdirSync(dest, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', dest, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('remote', 'add', 'origin', url);
  git('fetch', '-q', '--depth', '1', 'origin', ref);
  git('checkout', '-q', 'FETCH_HEAD');
  rmSync(join(dest, '.git'), { recursive: true, force: true });
}
