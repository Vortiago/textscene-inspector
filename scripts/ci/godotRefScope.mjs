#!/usr/bin/env node
/**
 * Decides whether a pull request needs the real-Godot tests. They run when a changed file is one
 * the tests read, or one that defines the run. CI passes `git diff --name-only` on stdin and
 * appends `godot-ref=true|false` to $GITHUB_OUTPUT. It runs before the workspace installs, so it
 * imports no package.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { isEngineTestInput } from '../godot-ref/engineTestInputs.mjs';

/** The files that define the CI run or what it installs. No import of a test names them. */
const RUN_DEFINITION = /^(?:\.github\/(?:workflows\/ci\.yml$|actions\/)|pnpm-lock\.yaml$|package\.json$)/;

/**
 * @param {string[]} changedPaths - repo-relative paths, as `git diff --name-only` prints them.
 * @param {(path: string) => boolean} readsInput - whether the real-Godot tests read the path.
 * @returns {boolean} true for an empty list too: a diff that came back empty is more likely a
 *   broken checkout than a change to nothing.
 */
export function needsGodotRefRun(changedPaths, readsInput) {
  if (changedPaths.length === 0) return true;
  return changedPaths.some((path) => RUN_DEFINITION.test(path) || readsInput(path));
}

function main() {
  const changedPaths = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  const needed = needsGodotRefRun(changedPaths, isEngineTestInput);
  console.error(`[godotRefScope] ${changedPaths.length} changed file(s): godot-ref=${needed}`);
  console.log(`godot-ref=${needed}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
