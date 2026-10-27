/**
 * Writes the "One way to do each thing" list in AGENTS.md from the `@oneWay` tags in the core's
 * source, between the `one-way:begin` and `one-way:end` markers. `--check` fails instead of
 * writing, so CI stops a list that no longer matches the code.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { oneWayEntries, renderOneWayList } from './oneWayTags.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = join(ROOT, 'packages/textscene-core/src');
const AGENTS = join(ROOT, 'AGENTS.md');
const BEGIN = '<!-- one-way:begin -->';
const END = '<!-- one-way:end -->';

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function taggedEntries() {
  return sourceFiles(SOURCE).flatMap((path) =>
    oneWayEntries(readFileSync(path, 'utf8'), relative(SOURCE, path).replaceAll('\\', '/'))
  );
}

const current = readFileSync(AGENTS, 'utf8');
const begin = current.indexOf(BEGIN);
const end = current.indexOf(END);
if (begin === -1 || end < begin) {
  console.error(`[one-way] expected ${BEGIN} before ${END} in AGENTS.md, found neither in order`);
  process.exit(1);
}
const entries = taggedEntries();
const next = `${current.slice(0, begin + BEGIN.length)}\n${renderOneWayList(entries)}${current.slice(end)}`;

if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('[one-way] the AGENTS.md list is STALE: run `pnpm docs:one-way`.');
    process.exit(1);
  }
  console.log('[one-way] up to date.');
} else {
  writeFileSync(AGENTS, next);
  console.log(`[one-way] wrote ${entries.length} helpers.`);
}
