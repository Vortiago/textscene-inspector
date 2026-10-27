/**
 * Shared steps of a script that generates a committed file: splice a generated block between two
 * markers, and write the files or, under `--check`, report the stale ones.
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
 * Writes each `[path, text]` of `outputs` whose file differs from `text`, and names the paths it
 * wrote, or says every file is up to date. `tool` prefixes each message, and `summary`, when
 * given, follows the outcome.
 */
export function writeGenerated(outputs, { tool, summary }) {
  const changed = staleOutputs(outputs);
  for (const { path, text } of changed) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  if (changed.length === 0) {
    console.log(outcome(tool, 'up to date', summary, '.'));
    return;
  }
  console.log(outcome(tool, `wrote ${changed.length} file(s)`, summary, ':'));
  for (const { path } of changed) console.log(`  ${displayPath(path)}`);
}

/**
 * Writes nothing. Names each stale path of `outputs` with the line where it first differs and the
 * `command` that regenerates it, and fails the run, or says every file is up to date. `tool` and
 * `summary` work as in `writeGenerated`.
 */
export function checkGenerated(outputs, { tool, command, summary }) {
  const stale = staleOutputs(outputs);
  if (stale.length === 0) {
    console.log(outcome(tool, 'up to date', summary, '.'));
    return;
  }
  console.error(outcome(tool, `${stale.length} file(s) are STALE`, summary, `, run \`${command}\`:`));
  for (const { path, text, actual } of stale)
    console.error(`  ${displayPath(path)} (${difference(actual, text)})`);
  process.exitCode = 1;
}

/** Each output whose file differs from its text, with the text the file holds now. */
function staleOutputs(outputs) {
  return outputs
    .map(([path, text]) => ({ path, text, actual: readOrNothing(path) }))
    .filter(({ text, actual }) => actual !== text);
}

function outcome(tool, text, summary, end) {
  return `[${tool}] ${text}${summary ? ` (${summary})` : ''}${end}`;
}

/** Where `actual`, which differs from `expected`, first departs from it, as a reader finds it. */
function difference(actual, expected) {
  if (actual === undefined) return 'missing';
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const lineCount = Math.max(actualLines.length, expectedLines.length);
  let index = 0;
  while (index < lineCount && actualLines[index] === expectedLines[index]) index++;
  return `first difference at line ${index + 1}`;
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
