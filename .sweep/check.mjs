// The prose guard's findings for the given files, one line each.
// Usage: node .sweep/check.mjs <paths…>   Exit 1 when any finding remains.
import console from 'node:console';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { devKit, kindOf, repoRoot } from './scan.mjs';

const { commentBlocks, commentViolations, markdownViolations, tscnCommentBlocks } = devKit;

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

function findings(path) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8');
  if (kindOf(path) === 'md') {
    return markdownViolations(source).map(({ line, violation }) => ({ line, ...violation }));
  }
  const blocks = path.endsWith('.tscn')
    ? tscnCommentBlocks(source)
    : commentBlocks(source, { blockOnly: path.endsWith('.css') });
  return blocks.flatMap((block) =>
    commentViolations(block.text).map((v) => ({ line: lineOf(source, block.index), ...v }))
  );
}

let total = 0;
for (const path of process.argv.slice(2)) {
  for (const { line, rule, found } of findings(path)) {
    total++;
    console.log(`${path}:${line} ${rule}: "${found}"`);
  }
}
console.log(`${total} finding(s)`);
process.exitCode = total > 0 ? 1 : 0;
