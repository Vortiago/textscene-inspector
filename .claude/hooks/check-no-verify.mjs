#!/usr/bin/env node
/**
 * PreToolUse hook for the Bash tool: refuses a `git commit` that skips the Husky pre-commit hook
 * with `--no-verify` or its short form `-n`. It exits 2 to block, and 0 for every other command.
 */

import { readFileSync } from 'node:fs';

/** Exit status that makes Claude Code block the tool call and show stderr to Claude. */
const BLOCK = 2;

/** The Bash command in the hook input, or an empty string when the input holds none. */
function readCommand() {
  try {
    return JSON.parse(readFileSync(0, 'utf8')).tool_input?.command ?? '';
  } catch {
    // Unreadable input carries no commit to check, and a crash here must not block the call.
    return '';
  }
}

/** The command without its quoted strings, so a commit message that says `-n` is not a flag. */
function withoutQuotedText(command) {
  return command.replace(/'[^']*'|"(?:\\.|[^"\\])*"/g, '""');
}

/** The options after `commit` in each `git commit` of the command, one array per commit. */
function commitOptions(command) {
  return withoutQuotedText(command)
    .split(/&&|\|\||[;|\n]/)
    .map((segment) => segment.trim().split(/\s+/))
    .filter((words) => words.includes('git') && words.indexOf('commit') > words.indexOf('git'))
    .map((words) => words.slice(words.indexOf('commit') + 1));
}

/** True for `--no-verify`, and for a short-option cluster that holds `n`, such as `-n` or `-anm`. */
function skipsHooks(option) {
  return option === '--no-verify' || /^-[A-Za-z]*n[A-Za-z]*$/.test(option);
}

const refused = commitOptions(readCommand()).flat().find(skipsHooks);
if (refused) {
  console.error(
    `Blocked: \`git commit ${refused}\` skips the Husky pre-commit hook. ` +
      'This project requires the pre-commit checks on every commit. Commit without the flag.'
  );
  process.exit(BLOCK);
}
