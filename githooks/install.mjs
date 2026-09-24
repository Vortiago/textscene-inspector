#!/usr/bin/env node
/**
 * The `prepare` script: points this worktree's `core.hooksPath` at `githooks/`.
 *
 * It writes the setting per worktree, so a worktree on an older commit keeps the hooks path
 * that the shared config gives it. Git allows a per-worktree setting beside other worktrees
 * only when `extensions.worktreeConfig` is on. Without it, this prints the one-time migration
 * and leaves the config as it is, so `pnpm install` still succeeds.
 */

import { execFileSync } from 'node:child_process';

const HOOKS_PATH = 'githooks';

/** The trimmed stdout of `git <args>`, or nothing when git fails or is missing. */
function git(...args) {
  try {
    const options = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    return execFileSync('git', args, options).trim();
  } catch {
    // A failed read answers the question: the value is absent, or this is no repository.
    return undefined;
  }
}

/** The number of worktrees, a bare repository's own entry included, as git counts them. */
function countWorktrees() {
  const lines = (git('worktree', 'list', '--porcelain') ?? '').split('\n');
  return lines.filter((line) => line.startsWith('worktree ')).length;
}

/**
 * The commands that enable `extensions.worktreeConfig`. Git reads `core.bare` from the common
 * config in every worktree once the extension is on, so `core.bare` moves first to the main
 * worktree's `config.worktree`. The opposite order makes every linked worktree bare.
 */
function migrationCommands() {
  const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  const commonConfig = `git config --file "${commonDir}/config"`;
  const bare = git('config', '--file', `${commonDir}/config`, 'core.bare');
  const moveBare =
    bare === undefined
      ? []
      : [
          `git config --file "${commonDir}/config.worktree" core.bare ${bare}`,
          `${commonConfig} --unset core.bare`,
        ];
  return [...moveBare, `${commonConfig} extensions.worktreeConfig true`, 'pnpm install'];
}

function install() {
  if (process.env.HUSKY === '0') {
    console.log('HUSKY=0: git hooks not installed.');
    return;
  }
  if (git('rev-parse', '--is-inside-work-tree') !== 'true') {
    console.log('Not a git worktree: git hooks not installed.');
    return;
  }
  const hasWorktreeConfig = git('config', '--bool', 'extensions.worktreeConfig') === 'true';
  if (!hasWorktreeConfig && countWorktrees() > 1) {
    console.warn(
      'Git hooks not installed: this repository has several worktrees and no ' +
        'extensions.worktreeConfig. Run these commands once, in this order:\n' +
        migrationCommands().map((command) => `  ${command}`).join('\n')
    );
    return;
  }
  execFileSync('git', ['config', '--worktree', 'core.hooksPath', HOOKS_PATH], { stdio: 'inherit' });
}

install();
