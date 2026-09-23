// Gate: every change outside comments is listed, so the reviewer can confirm each is dead code.
// Usage: node .sweep/commentOnly.mjs [paths…]   Exit 1 when any code changed.
import console from 'node:console';
import process from 'node:process';
import { after, before, changedFiles } from './changed.mjs';
import { devKit } from './scan.mjs';

/** The code lines of a file: comments blanked, then blank lines and indentation dropped. */
function codeLines(path, text) {
  const code = path.endsWith('.tscn')
    ? text.replace(/^;[^\n]*$/gm, '')
    : devKit.stripComments(text);
  return code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** Lines only one side has, as a multiset difference in both directions. */
function difference(a, b) {
  const counts = new Map();
  for (const line of a) counts.set(line, (counts.get(line) ?? 0) + 1);
  for (const line of b) counts.set(line, (counts.get(line) ?? 0) - 1);
  const removed = [];
  const added = [];
  for (const [line, n] of counts) {
    for (let i = 0; i < Math.abs(n); i++) (n > 0 ? removed : added).push(line);
  }
  return { removed, added };
}

let changedCode = 0;
for (const path of changedFiles()) {
  if (path.endsWith('.md')) continue;
  const { removed, added } = difference(codeLines(path, before(path)), codeLines(path, after(path)));
  if (removed.length + added.length === 0) continue;
  changedCode++;
  console.log(`\n${path}`);
  for (const line of removed) console.log(`  - ${line}`);
  for (const line of added) console.log(`  + ${line}`);
}
console.log(`\n${changedCode} file(s) changed outside comments`);
process.exitCode = changedCode > 0 ? 1 : 0;
