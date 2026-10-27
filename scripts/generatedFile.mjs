/**
 * Shared steps of a script that generates a committed file: splice a generated block between two
 * markers, and write the file or, under `--check`, report that it is stale.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';

/**
 * `text` with everything between the end of `begin` and the start of `end` replaced by a newline
 * and `body`. `body` brings its own trailing newline. Throws when a marker is missing or out of order.
 */
export function replaceMarkedBlock(text, begin, end, body) {
  const start = text.indexOf(begin);
  if (start === -1) throw new Error(`no ${begin} in the text`);
  const stop = text.indexOf(end, start + begin.length);
  if (stop === -1) throw new Error(`no ${end} after ${begin}`);
  return `${text.slice(0, start + begin.length)}\n${body}${text.slice(stop)}`;
}

/**
 * Writes each `[path, text]` of `outputs` whose file differs from `text`, and returns those paths.
 * Under `check` it writes nothing: it reports the stale paths with the `command` that regenerates
 * them and fails the run, or reports that every file is up to date. `tool` prefixes each message.
 */
export function writeOrCheck(outputs, { check, tool, command }) {
  const changed = outputs.filter(([path, text]) => readOrNothing(path) !== text);
  const paths = changed.map(([path]) => path);
  if (check) {
    reportCheck(paths, { tool, command });
    return paths;
  }
  for (const [path, text] of changed) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return paths;
}

function reportCheck(stale, { tool, command }) {
  if (stale.length === 0) {
    console.log(`[${tool}] up to date.`);
    return;
  }
  console.error(`[${tool}] ${stale.length} file(s) are STALE, run \`${command}\`:`);
  for (const path of stale) console.error(`  ${displayPath(path)}`);
  process.exitCode = 1;
}

/** Nothing, not an empty string, for a missing file: an empty generated file is real. */
function readOrNothing(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
}

/** A path inside the repo relative to its root, any other path as given. */
function displayPath(path) {
  const fromRoot = relative(REPO_ROOT, path);
  return fromRoot && !fromRoot.startsWith('..') ? fromRoot : path;
}
