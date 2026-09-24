#!/usr/bin/env node
/**
 * The pre-push hook: runs the checks `planChecks` picks for the pushed commits. Git writes one
 * line per pushed ref on stdin: `<local ref> <local sha> <remote ref> <remote sha>`.
 * `FULL_VALIDATE=1 git push` runs the full `pnpm validate` instead.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { planChecks } from './prePushPlan.mjs';

/** Git writes this sha for a ref that does not exist on one side of the push. */
const NO_SHA = /^0+$/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

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
  try {
    return git('merge-base', localSha, 'origin/main');
  } catch {
    // No origin/main in this clone: the caller runs the full gate.
    return undefined;
  }
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
    for (const entry of git('diff', '--name-status', '--no-renames', base, localSha).split('\n')) {
      const [status, path] = entry.split('\t');
      if (!path) continue;
      (status === 'D' ? deleted : changed).add(path);
    }
  }
  return { changed: [...changed], deleted: [...deleted] };
}

function run(command) {
  console.log(`pre-push: ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
  return result.status ?? 1;
}

function main() {
  const files = process.env.FULL_VALIDATE === '1' ? undefined : pushedFiles(readFileSync(0, 'utf8'));
  const plan = files === undefined ? [['pnpm', 'validate']] : planChecks(files);
  if (plan.length === 0) console.log('pre-push: no check applies to these files. CI runs the full gate.');
  for (const command of plan) {
    const status = run(command);
    if (status !== 0) {
      process.exitCode = status;
      return;
    }
  }
}

main();
