// Writes .sweep/batches.json: the frozen partition of the sweep into waves and batches.
// Run once. A resumed sweep reads the file and never rebuilds it.
import console from 'node:console';
import process from 'node:process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repoRoot, scanTree } from './scan.mjs';

const OUT = resolve(repoRoot, '.sweep/batches.json');
if (existsSync(OUT) && !process.argv.includes('--force')) {
  throw new Error(`${OUT} exists and is frozen; pass --force only before wave 1 starts`);
}

/** Comment lines one editor agent takes: about 100 files of code. */
const CODE_BATCH_LINES = 3000;
/** Sheet lines one editor agent takes: dense tables, read in full. */
const SHEET_BATCH_LINES = 2500;
/** Editor agents in one wave, so one Workflow run stays small. */
const EDITORS_PER_WAVE = 8;

const files = scanTree();
const byPath = new Map(files.map((f) => [f.path, f]));
const md = files.filter((f) => f.kind === 'md');

/** Wave 1: the documents every later agent reads, so they are clean first. */
const PROSE_GROUPS = [
  ['agents', (p) => p === 'AGENTS.md' || p === 'CLAUDE.md'],
  ['context', (p) => p === 'CONTEXT.md'],
  ['architecture', (p) => p === 'ARCHITECTURE.md'],
  ['claude-dir', (p) => p.startsWith('.claude/')],
  ['compare-docs', (p) => p.startsWith('scripts/compare-docs/') || p === 'docs/comparison/README.md'],
];
const isSheet = (p) => p.endsWith('/comparison.md') || p.startsWith('docs/comparison/sheets/');
const isAdr = (p) => p.startsWith('docs/adr/');

/** Consecutive paths, cut into batches of about `budget` weight each. */
function chunk(paths, budget, weight) {
  const batches = [];
  let current = [];
  let total = 0;
  for (const path of paths) {
    const w = weight(path);
    if (current.length > 0 && total + w > budget) {
      batches.push(current);
      current = [];
      total = 0;
    }
    current.push(path);
    total += w;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/** A short label: the deepest directory the batch's first and last files share. */
function labelOf(paths) {
  const a = paths[0].split('/');
  const b = paths.at(-1).split('/');
  const shared = [];
  for (let i = 0; i < Math.min(a.length, b.length) - 1 && a[i] === b[i]; i++) shared.push(a[i]);
  const tail = shared.filter((s) => !['packages', 'textscene-core', 'src'].includes(s));
  return (tail.slice(-2).join('-') || 'root').replace(/[^a-z0-9-]/gi, '').toLowerCase();
}

const batches = [];
const add = (wave, kind, label, paths) =>
  batches.push({ id: `w${wave}-${String(batches.length + 1).padStart(2, '0')}-${label}`, wave, kind, files: paths });

const prose = md.map((f) => f.path).filter((p) => !isSheet(p) && !isAdr(p));
const claimed = new Set();
for (const [label, test] of PROSE_GROUPS) {
  const paths = prose.filter((p) => test(p));
  paths.forEach((p) => claimed.add(p));
  add(1, 'prose', label, paths);
}
add(1, 'prose', 'guides-readmes', prose.filter((p) => !claimed.has(p)));

const adrs = md.map((f) => f.path).filter(isAdr).sort();
const half = Math.ceil(adrs.length / 2);
add(2, 'adr', 'adr-a', adrs.slice(0, half));
add(2, 'adr', 'adr-b', adrs.slice(half));
const sheets = md.map((f) => f.path).filter(isSheet).sort();
for (const paths of chunk(sheets, SHEET_BATCH_LINES, (p) => byPath.get(p).lines)) {
  add(2, 'sheet', `sheets-${labelOf(paths)}`, paths);
}

const code = files
  .filter((f) => (f.kind === 'code' || f.kind === 'tscn') && f.lines > 0)
  .map((f) => f.path)
  .sort();
const codeBatches = chunk(code, CODE_BATCH_LINES, (p) => byPath.get(p).lines);
codeBatches.forEach((paths, i) => {
  add(3 + Math.floor(i / EDITORS_PER_WAVE), 'code', labelOf(paths), paths);
});

writeFileSync(OUT, `${JSON.stringify({ base: '9a495d2a26f98e8603e2b657bddddbf2aa664156', batches }, null, 1)}\n`);
for (const b of batches) {
  const lines = b.files.reduce((s, p) => s + byPath.get(p).lines, 0);
  console.log(b.id.padEnd(48), String(b.files.length).padStart(4), 'files', String(lines).padStart(6), 'lines');
}
