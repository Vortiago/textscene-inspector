/**
 * Runs a check plan in order and stops at the first check that fails. Below the tool's own output,
 * a failure ends with a summary that names the check and the commands that rerun it.
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** The arguments that only start a tool: `pnpm exec eslint` runs the check `eslint`. */
const LAUNCHERS = new Set(['pnpm', 'npx', 'node', 'exec']);
/** An argument that a POSIX shell and PowerShell both read as one plain word. */
const PLAIN_WORD = /^[\w@%+=:,./-]+$/;

/** The name of the check that `command` runs: its first argument that is not a launcher or a flag. */
export function checkName(command) {
  for (let i = 0; i < command.length; i++) {
    const arg = command[i];
    if (arg === '--filter') i++;
    else if (!LAUNCHERS.has(arg) && !arg.startsWith('-')) return arg;
  }
  return command.join(' ');
}

/** `command` as a line to paste into a shell. Single quotes keep a glob such as `./packages/*` whole. */
export function commandLine(command) {
  return command.map((arg) => (PLAIN_WORD.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`)).join(' ');
}

/**
 * The lines that close a failed run. `position` counts the checks from 1. `outcome` is the exit
 * status, or the reason the command did not start.
 */
export function failureSummary(tag, { command, position, total, outcome }) {
  return [
    '',
    `${tag}: FAILED check ${position} of ${total}: ${checkName(command)} (${outcome})`,
    `${tag}: rerun this check with: ${commandLine(command)}`,
    `${tag}: rerun every push check on your working tree with: pnpm check`,
  ].join('\n');
}

/** How a finished command failed, from the result of `spawnSync`. */
function outcomeOf(result) {
  if (result.error) return `did not start: ${result.error.message}`;
  if (result.signal) return `stopped by ${result.signal}`;
  return `exit status ${result.status}`;
}

/** Runs `plan`, a list of argv arrays, and returns 0, or the exit status of the first failed check. */
export function runChecks(tag, plan) {
  if (plan.length === 0) console.log(`${tag}: no check applies to these files. CI runs the full gate.`);
  for (const [index, command] of plan.entries()) {
    console.log(`${tag}: ${command.join(' ')}`);
    // A shell on Windows, where `npx` and a Corepack `pnpm` are `.cmd` files that spawn cannot start.
    const result = spawnSync(command[0], command.slice(1), {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status === 0) continue;
    const outcome = outcomeOf(result);
    console.error(failureSummary(tag, { command, position: index + 1, total: plan.length, outcome }));
    return result.status || 1;
  }
  return 0;
}
