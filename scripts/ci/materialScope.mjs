#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { changedPathsOf } from './shaderScope.mjs';

/** The generator, the sweep that records Godot's texts, its digests and the image that holds Godot. */
const SWEEP_INPUTS =
  /^(?:packages\/textscene-core\/src\/(?:shaders\/material\/|godot\/rendering\/materials\/|godot\/scene\/baseMaterial3D\.ts$)|scripts\/godot-probes\/(?:materialTexts|shaderBetween|shaderVerdicts|godotRun|answerDigest|run)\.mjs$|apps\/textscene-three-godot-shaders\/tests\/(?:materials\/|godotAnswers\.mjs$)|\.github\/ci-image\/)/;

/**
 * @param {string[]} changedPaths - repo-relative paths, as `git diff --name-only` prints them.
 * @returns {boolean} true for an empty list too: a diff that came back empty is more likely a
 *   broken checkout than a change to nothing.
 */
export function needsMaterialSweep(changedPaths) {
  if (changedPaths.length === 0) return true;
  return changedPaths.some((path) => SWEEP_INPUTS.test(path));
}

/** Reads `git diff --name-only` on stdin and prints `material-sweep=true|false` for $GITHUB_OUTPUT. */
function main() {
  const changedPaths = changedPathsOf(readFileSync(0, 'utf8'));
  const needed = needsMaterialSweep(changedPaths);
  console.error(`[materialScope] ${changedPaths.length} changed file(s): material-sweep=${needed}`);
  console.log(`material-sweep=${needed}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
