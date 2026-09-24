#!/usr/bin/env node
/**
 * The `prepare` script: points this worktree's `core.hooksPath` at `githooks/`. The setting is
 * per worktree, so a worktree on an older commit keeps its own hooks. When other worktrees share
 * the config and `extensions.worktreeConfig` is off, it prints the commands that turn it on.
 */

import { execFileSync } from 'node:child_process';

const HOOKS_PATH = 'githooks';

/** The trimmed stdout of `git <args>`, or nothing when git fails or is missing. */
function readGit(...args) {
  try {
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    return execFileSync('git', args, options).trim();
  } catch {
    // A failed read answers the question: the value is absent, or this is no repository.
    return undefined;
  }
}

/** The number of worktrees, a bare repository's own entry included. */
function countWorktrees() {
  const lines = (readGit('worktree', 'list', '--porcelain') ?? '').split('\n');
  return lines.filter((line) => line.startsWith('worktree ')).length;
}

/**
 * The commands that turn on `extensions.worktreeConfig`, in order. With the extension on, every
 * worktree reads a shared `core.bare`, so it moves to the main worktree's `config.worktree` first.
 */
function worktreeConfigCommands() {
  const commonDir = readGit('rev-parse', '--path-format=absolute', '--git-common-dir');
  const sharedConfig = `git config --file "${commonDir}/config"`;
  const bare = readGit('config', '--file', `${commonDir}/config`, 'core.bare');
  const moveBare =
    bare === undefined
      ? []
      : [`git config --file "${commonDir}/config.worktree" core.bare ${bare}`, `${sharedConfig} --unset core.bare`];
  return [...moveBare, `${sharedConfig} extensions.worktreeConfig true`, 'pnpm install'];
}

function printWorktreeConfigCommands() {
  console.warn(
    'Git hooks not installed: other worktrees share this config and extensions.worktreeConfig ' +
      'is off. Run these commands once, in this order:\n' +
      worktreeConfigCommands().map((command) => `  ${command}`).join('\n')
  );
}

function writeHooksPath() {
  execFileSync('git', ['config', '--worktree', 'core.hooksPath', HOOKS_PATH], { stdio: 'inherit' });
}

function install() {
  if (process.env.HUSKY === '0') {
    console.log('HUSKY=0: git hooks not installed.');
    return;
  }
  if (readGit('rev-parse', '--is-inside-work-tree') !== 'true') {
    console.log('Not a git worktree: git hooks not installed.');
    return;
  }
  const hasWorktreeConfig = readGit('config', '--bool', 'extensions.worktreeConfig') === 'true';
  if (!hasWorktreeConfig && countWorktrees() > 1) {
    printWorktreeConfigCommands();
    return;
  }
  writeHooksPath();
}

install();
