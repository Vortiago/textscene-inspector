/**
 * The changed files of a push or a working tree, and the check plan for them. The pre-push hook
 * and `pnpm check` share these reads.
 */

import { execFileSync } from 'node:child_process';
import { changedEntries } from '../gitNameStatus.mjs';
import { readTestsBeside } from './colocatedTests.mjs';
import { isNegativeFixture } from './negativeFixtures.mjs';
import { planChecks, STATIC_GATE } from './prePushPlan.mjs';

/**
 * Room for the diff of a whole branch. Node's default of 1 MB stops the command with `ENOBUFS`,
 * and 2 of the last 49 commits on main carry a text diff past it, the largest 4.4 MB.
 */
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/** The trimmed stdout of `git <args>`. A failed command throws, and its stderr stays hidden. */
export function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: MAX_OUTPUT_BYTES,
  }).trim();
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

/** The paths in `git diff --name-status --no-renames` output, split by whether they still exist. */
export function parseNameStatus(text) {
  const changed = [];
  const deleted = [];
  for (const { change, path } of changedEntries(text)) {
    (change === 'removed' ? deleted : changed).push(path);
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
