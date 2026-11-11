/**
 * Git plumbing shared by the vendor scripts, in one place like vendor-prune.mjs, so the vendored
 * corpora cannot diverge.
 */
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

/** What git sets for a hook, and reads in place of the repository it would find from the directory. */
const HOOK_REPOSITORY_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];

/**
 * The environment for a git command that must act on `dir` alone. The ceiling hides a repository
 * above `dir`, and a hook's `GIT_DIR` goes. With either, `git apply` skips every file and exits 0,
 * and `git init` makes no repository in `dir`.
 */
export function gitEnvironmentFor(dir) {
  const environment = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) };
  for (const name of HOOK_REPOSITORY_VARIABLES) delete environment[name];
  return environment;
}

/** Shallow-fetches one ref (branch, tag or commit) into `dest`, with no history and no .git. */
export function fetchShallow(url, ref, dest) {
  mkdirSync(dest, { recursive: true });
  const env = gitEnvironmentFor(dest);
  const git = (...args) => execFileSync('git', ['-C', dest, ...args], { stdio: 'pipe', env });
  git('init', '-q');
  git('remote', 'add', 'origin', url);
  git('fetch', '-q', '--depth', '1', 'origin', ref);
  git('checkout', '-q', 'FETCH_HEAD');
  rmSync(join(dest, '.git'), { recursive: true, force: true });
}
