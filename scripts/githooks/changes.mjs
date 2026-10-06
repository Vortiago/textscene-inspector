/**
 * The changed files of a push or a working tree, and the check plan for them. The pre-push hook
 * and `pnpm check` share these reads.
 */

import { execFileSync } from 'node:child_process';
import { readTestsBeside } from './colocatedTests.mjs';
import { isNegativeFixture } from './negativeFixtures.mjs';
import { planChecks, STATIC_GATE } from './prePushPlan.mjs';

/** The trimmed stdout of `git <args>`. A failed command throws, and its stderr stays hidden. */
export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** The commit where `rev` left `origin/main`, or undefined when this clone has no `origin/main`. */
export function mergeBaseWithMain(rev) {
  try {
    return git('merge-base', rev, 'origin/main');
  } catch {
    // The caller runs the static checks over the whole repository.
    return undefined;
  }
}

/**
 * The paths in `git diff --name-status --no-renames` output, one `<status>\t<path>` entry per line,
 * split by whether they still exist.
 */
export function parseNameStatus(text) {
  const changed = [];
  const deleted = [];
  for (const entry of text.split('\n')) {
    const [status, path] = entry.split('\t');
    if (!path) continue;
    (status === 'D' ? deleted : changed).push(path);
  }
  return { changed, deleted };
}

/**
 * The commands for `files`, the changed and deleted paths on disk. Undefined `files` means the base
 * of the change is unknown, so the plan runs the static checks over the whole repository.
 */
export function planForFiles(files) {
  return files === undefined
    ? STATIC_GATE
    : planChecks({ ...files, isNegativeFixture, testsBeside: readTestsBeside });
}
