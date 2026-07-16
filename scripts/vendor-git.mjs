/**
 * Shared git plumbing for the vendor scripts — single-sourced (like
 * vendor-prune.mjs) so the vendored corpora can't silently diverge.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Shallow-fetch a single ref (branch/tag/commit) into `dest` (no history, no .git). */
export function fetchShallow(url, ref, dest) {
  mkdirSync(dest, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', dest, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('remote', 'add', 'origin', url);
  git('fetch', '-q', '--depth', '1', 'origin', ref);
  git('checkout', '-q', 'FETCH_HEAD');
  rmSync(join(dest, '.git'), { recursive: true, force: true });
}
