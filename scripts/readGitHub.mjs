/**
 * Reads GitHub through the `gh` CLI, for the scripts that report on a pull request or on the issues.
 */

import { execFileSync } from 'node:child_process';

/** A page of 100 issues takes about 0.6 MB, and Node stops a child process at 1 MB by default. */
const MAX_ANSWER_BYTES = 64 * 1024 * 1024;

/**
 * GitHub's answer to `gh api <args>`.
 *
 * @canonical Read the GitHub API through the gh CLI
 */
export function readGitHub(...args) {
  try {
    return execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: MAX_ANSWER_BYTES });
  } catch (error) {
    throw new Error(`read GitHub with \`gh api ${args.join(' ')}\`: ${error.message}`, { cause: error });
  }
}
