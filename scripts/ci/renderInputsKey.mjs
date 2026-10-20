#!/usr/bin/env node
/**
 * Names the inputs of the golden-image run: a hash of every file a golden scene may render
 * through, by path and blob. Two trees with one key give the same captures, so CI skips the run on
 * a tree whose key already passed. CI passes `git ls-tree -r HEAD` on stdin and appends
 * `key=<hash>` to $GITHUB_OUTPUT.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { rendersGoldens } from './visualScope.mjs';

/**
 * @param {string} treeListing - `git ls-tree -r` output: `<mode> <type> <object>\t<path>` lines.
 * @returns {string} SHA-256 in hex of the lines whose path `rendersGoldens`, in listing order.
 */
export function renderInputsKey(treeListing) {
  const renderingLines = treeListing
    .split('\n')
    .filter((line) => line && rendersGoldens(line.slice(line.indexOf('\t') + 1)));
  return createHash('sha256').update(renderingLines.join('\n')).digest('hex');
}

function main() {
  console.log(`key=${renderInputsKey(readFileSync(0, 'utf8'))}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
