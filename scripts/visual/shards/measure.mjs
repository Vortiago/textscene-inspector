#!/usr/bin/env node
/**
 * Rewrites sceneSeconds.json, the seconds each golden scene takes to capture on a CI runner, from
 * the logs of the visual-regression shards. A scene seen in several logs gets the mean. A scene the
 * logs miss keeps its old value, and a scene no longer in the manifest drops out.
 *
 * @example
 *   gh run view <run-id> --log > run.log
 *   pnpm test:visual:measure run.log [more.log ...]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { GOLDEN_SCENES } from '../scenes.mjs';

const TABLE_PATH = new URL('./sceneSeconds.json', import.meta.url);

/**
 * Matches the harness lines that start a scene's clock and stop it. The timestamp is the one
 * GitHub Actions writes before each log line, and `gh run view --log` keeps it.
 */
const HARNESS_LINE =
  /(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) \[visual\] (?:preview at |browser ready|\d+\/\d+ (\S+) )/;

/**
 * The capture seconds of each scene line in a log, in log order. A scene's clock starts at the
 * line before it: `browser ready` for a shard's first scene, else the scene before. A log from
 * before `browser ready` existed starts the first clock at `preview at`, so the first scene of
 * each shard also carries the browser launch.
 *
 * @param {string} log - one or more shard logs, each shard's lines contiguous.
 * @returns {{ name: string, seconds: number }[]}
 */
export function parseSceneSeconds(log) {
  const samples = [];
  let clockStart = null;
  for (const line of log.split('\n')) {
    const match = HARNESS_LINE.exec(line);
    if (!match) continue;
    const at = Date.parse(match[1]);
    const name = match[2];
    if (name && clockStart !== null) samples.push({ name, seconds: (at - clockStart) / 1000 });
    clockStart = at;
  }
  return samples;
}

/**
 * The new table: the mean of each scene's samples over its old value, restricted to `names` and
 * sorted by name so a rewrite diffs line by line. Seconds keep one decimal.
 *
 * @param {Record<string, number>} table - the current seconds by scene name.
 * @param {{ name: string, seconds: number }[]} samples
 * @param {string[]} names - the scenes in the manifest.
 * @returns {Record<string, number>}
 */
export function mergeSeconds(table, samples, names) {
  const sums = new Map();
  for (const { name, seconds } of samples) {
    const sum = sums.get(name) ?? { total: 0, count: 0 };
    sums.set(name, { total: sum.total + seconds, count: sum.count + 1 });
  }
  const merged = {};
  for (const name of [...names].sort()) {
    const sum = sums.get(name);
    const seconds = sum ? sum.total / sum.count : table[name];
    if (seconds !== undefined) merged[name] = Math.round(seconds * 10) / 10;
  }
  return merged;
}

function main() {
  const logPaths = process.argv.slice(2);
  if (logPaths.length === 0) {
    console.error('[visual] measure needs one or more CI log files');
    process.exit(2);
  }
  const samples = logPaths.flatMap((path) => parseSceneSeconds(readFileSync(path, 'utf8')));
  const table = JSON.parse(readFileSync(TABLE_PATH, 'utf8'));
  const names = GOLDEN_SCENES.map((scene) => scene.name);
  const merged = mergeSeconds(table, samples, names);
  writeFileSync(TABLE_PATH, `${JSON.stringify(merged, null, 2)}\n`);
  const measured = new Set(samples.map((s) => s.name)).size;
  console.log(`[visual] ${measured} scene(s) measured, ${Object.keys(merged).length} in the table`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
