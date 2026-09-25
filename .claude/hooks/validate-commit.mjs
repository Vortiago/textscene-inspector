#!/usr/bin/env node
/**
 * PreToolUse hook for `mcp__github_file_ops__commit_files`, the tool that commits through the
 * GitHub API, where no git hook runs. It runs the pre-commit checks from
 * `lint-staged.config.mjs` on the files the tool commits. It exits 2 when a check fails, else 0.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, delimiter, join, matchesGlob, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Exit status that makes Claude Code block the tool call and show stderr to Claude. */
const BLOCK = 2;

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/** The paths the tool commits, or an empty array when the input holds none. */
function readCommittedFiles() {
  try {
    return JSON.parse(readFileSync(0, 'utf8')).tool_input?.files ?? [];
  } catch {
    // Unreadable input carries no files to check, and a crash here must not block the commit.
    return [];
  }
}

/** The commands one lint-staged task runs: a function builds them, a string gets the paths appended. */
async function commandsFor(task, files) {
  if (typeof task === 'function') return [await task(files)].flat();
  const quoted = files.map((file) => `"${file}"`).join(' ');
  return [task].flat().map((command) => `${command} ${quoted}`);
}

/** The pre-commit commands for these files, from each lint-staged task whose glob matches them. */
async function preCommitCommands(files) {
  const { default: tasks } = await import(pathToFileURL(join(projectDir, 'lint-staged.config.mjs')));
  const commands = [];
  for (const [glob, task] of Object.entries(tasks)) {
    // lint-staged matches a glob without a slash against the base name.
    const matching = files.filter((file) => matchesGlob(basename(file), glob));
    if (matching.length > 0) commands.push(...(await commandsFor(task, matching)));
  }
  return commands;
}

/** Runs one command in the project, with its output on stderr: stdout is the hook's reply. */
function run(command) {
  const binDir = join(projectDir, 'node_modules', '.bin');
  execSync(command, {
    cwd: projectDir,
    stdio: ['ignore', 2, 2],
    env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH}` },
  });
}

/** The first command that fails, or `undefined` when all pass. */
function firstFailing(commands) {
  return commands.find((command) => {
    try {
      run(command);
      return false;
    } catch {
      return true;
    }
  });
}

// The lint-staged config reads package manifests relative to the working directory.
process.chdir(projectDir);
const files = readCommittedFiles().map((file) => resolve(projectDir, file));
const failed = firstFailing(await preCommitCommands(files));
if (failed) {
  console.error(
    `Blocked: the pre-commit check \`${failed}\` failed on the committed files. ` +
      'Fix the errors it reports, then commit again.'
  );
  process.exit(BLOCK);
}
