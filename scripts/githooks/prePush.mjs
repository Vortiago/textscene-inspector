#!/usr/bin/env node
/**
 * The pre-push hook: runs the checks `planChecks` picks for the pushed commits. Git writes
 * one line per pushed ref on stdin: `<local ref> <local sha> <remote ref> <remote sha>`.
 * `FULL_VALIDATE=1 git push` runs the full `pnpm validate` instead, tests and packaging included.
 */

import { readFileSync } from 'node:fs';
import process from 'node:process';
import { git, mergeBaseWithMain, parseNameStatus, planForFiles } from './changes.mjs';
import { runChecks } from './runChecks.mjs';

/** Git writes this sha for a ref that does not exist on one side of the push. */
const NO_SHA = /^0+$/;

function hasCommit(sha) {
  try {
    git('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    // Not in this clone: the remote moved to a commit this clone has not fetched.
    return false;
  }
}

/** The commit a pushed ref is compared against, or undefined when none is known. */
function baseOf(localSha, remoteSha) {
  if (!NO_SHA.test(remoteSha) && hasCommit(remoteSha)) return remoteSha;
  return mergeBaseWithMain(localSha);
}

/** The changed and deleted paths of the push, or undefined when a base is missing. */
function pushedFiles(stdin) {
  const changed = new Set();
  const deleted = new Set();
  for (const line of stdin.split('\n').filter((l) => l.trim() !== '')) {
    const [, localSha, , remoteSha] = line.split(' ');
    if (NO_SHA.test(localSha)) continue;
    const base = baseOf(localSha, remoteSha);
    if (base === undefined) return undefined;
    const files = parseNameStatus(git('diff', '--name-status', '--no-renames', base, localSha));
    files.changed.forEach((path) => changed.add(path));
    files.deleted.forEach((path) => deleted.add(path));
  }
  return { changed: [...changed], deleted: [...deleted] };
}

if (process.env.FULL_VALIDATE === '1') {
  process.exitCode = runChecks('pre-push', [['pnpm', 'validate']]);
} else {
  const plan = planForFiles(pushedFiles(readFileSync(0, 'utf8')));
  process.exitCode = runChecks('pre-push', plan, 'pnpm check');
}
