#!/usr/bin/env node
/**
 * Differential proof helper for `drive-vscode.mjs`.
 *
 * "The canvas has ink" only proves SOMETHING painted. To attribute ink to one
 * feature, drive two scenes that differ in exactly that feature and diff the
 * captures: the surviving pixels are the feature, and their bounding box says
 * where it landed.
 *
 *   node scripts/vscode/ink-diff.mjs <a.png> <b.png> [--out diff.png] [--threshold n]
 *
 * Prints `{ diffPixels, bbox, size }` as JSON and, with `--out`, writes a
 * black/white mask of the differing pixels. Exits 1 if the two images differ in
 * size — two captures that laid out differently cannot attribute a difference
 * to one feature.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { diffMask } from './pixels.mjs';

const args = process.argv.slice(2);
const positional = [];
let outPath;
let threshold = 24;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outPath = args[++i];
  else if (args[i] === '--threshold') threshold = Number(args[++i]);
  else positional.push(args[i]);
}
// An unvalidated NaN makes every `delta > threshold` false, so the proof would
// report two arbitrarily different captures as identical and exit 0.
if (!Number.isFinite(threshold) || threshold < 0) {
  console.error(`--threshold must be a non-negative number, got ${JSON.stringify(threshold)}`);
  process.exit(2);
}
if (positional.length !== 2) {
  console.error('Usage: ink-diff.mjs <a.png> <b.png> [--out diff.png] [--threshold n]');
  process.exit(2);
}

let result;
try {
  result = diffMask(readFileSync(positional[0]), readFileSync(positional[1]), threshold);
} catch (error) {
  console.error(String(error.message ?? error));
  process.exit(1);
}

const { mask, ...summary } = result;
if (outPath) writeFileSync(outPath, PNG.sync.write(mask));
console.log(JSON.stringify({ ...summary, out: outPath ?? null }));
