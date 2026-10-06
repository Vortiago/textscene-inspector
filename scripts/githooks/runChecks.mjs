/**
 * Runs a check plan in order and stops at the first check that fails. Below the tool's own output,
 * a failure ends with a summary that names the check by the command that reruns it.
 */

import { spawnSync } from 'node:child_process';

/** An argument that a POSIX shell reads as one plain word. */
const PLAIN_WORD = /^[\w@%+=:,./-]+$/;

/** `command` as a line to paste into a POSIX shell. Single quotes keep a glob such as `./packages/*` whole. */
export function commandLine(command) {
  return command.map((arg) => (PLAIN_WORD.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`)).join(' ');
}

/** How a finished command failed, from the result of `spawnSync`. */
function outcomeOf(result) {
  if (result.error) return `did not start: ${result.error.message}`;
  if (result.signal) return `stopped by ${result.signal}`;
  return `exit status ${result.status}`;
}

/**
 * Runs `plan`, a list of argv arrays, and returns 0, or the exit status of the first failed check.
 * `rerunAll`, when given, is the command the summary offers to rerun the whole plan.
 */
export function runChecks(tag, plan, rerunAll) {
  if (plan.length === 0) console.log(`${tag}: no check applies to these files. CI runs the full gate.`);
  for (const [index, command] of plan.entries()) {
    console.log(`${tag}: ${commandLine(command)}`);
    // No shell: a changed path is an argument, and a shell would read its `&` or space as syntax.
    const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
    if (result.status === 0) continue;
    const summary = [
      '',
      `${tag}: FAILED check ${index + 1} of ${plan.length} (${outcomeOf(result)}). Rerun it with:`,
      `  ${commandLine(command)}`,
    ];
    if (rerunAll) summary.push(`${tag}: rerun every check with: ${rerunAll}`);
    console.error(summary.join('\n'));
    return result.status || 1;
  }
  return 0;
}
