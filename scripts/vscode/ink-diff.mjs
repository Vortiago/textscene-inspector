#!/usr/bin/env node
/**
 * Attributes ink to one feature: in two captures that differ only in it, the
 * differing pixels are the feature. Prints `{ diffPixels, bbox, size }` as JSON,
 * and `--out` writes a mask of them. Exits 1 when the sizes differ, since a
 * different layout cannot attribute a difference to one feature.
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
