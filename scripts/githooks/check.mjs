#!/usr/bin/env node
/**
 * `pnpm check`: runs the checks the pre-push hook picks, for every change since the branch left
 * `origin/main`. Commits, staged and unstaged edits and untracked files all count, so a developer
 * can fix what the push would refuse before the commit.
 */

import process from 'node:process';
import { parseNameStatus } from './changedFiles.mjs';
import { git } from './git.mjs';
import { planForFiles } from './planForFiles.mjs';
import { runChecks } from './runChecks.mjs';

function mergeBase() {
  try {
    return git('merge-base', 'HEAD', 'origin/main');
  } catch {
    console.log('check: no origin/main in this clone, so the static checks run over the whole repository.');
    return undefined;
  }
}

/** The changed and deleted paths of the working tree against `base`. Untracked files count as changed. */
function workingTreeFiles(base) {
  const { changed, deleted } = parseNameStatus(git('diff', '--name-status', '--no-renames', base));
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n');
  return { changed: [...changed, ...untracked.filter((path) => path !== '')], deleted };
}

const base = mergeBase();
process.exitCode = runChecks('check', planForFiles(base && workingTreeFiles(base)));
