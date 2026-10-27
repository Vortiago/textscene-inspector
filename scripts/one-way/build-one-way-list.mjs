/**
 * Writes the "One way to do each thing" list in AGENTS.md from the `@oneWay` tags in the core's
 * source, between the `one-way:begin` and `one-way:end` markers. `--check` fails instead of
 * writing, so CI stops a list that no longer matches the code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { replaceMarkedBlock, writeOrCheck } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { readSourceTree } from '../testOnlyExports.mjs';
import { oneWayEntries, renderOneWayList } from './oneWayTags.mjs';

const SOURCE = join(REPO_ROOT, 'packages/textscene-core/src');
const AGENTS = join(REPO_ROOT, 'AGENTS.md');
const BEGIN = '<!-- one-way:begin -->';
const END = '<!-- one-way:end -->';

function taggedEntries() {
  return [...readSourceTree(SOURCE)].flatMap(([path, text]) => oneWayEntries(text, path));
}

function agentsWithList(entries) {
  try {
    return replaceMarkedBlock(readFileSync(AGENTS, 'utf8'), BEGIN, END, renderOneWayList(entries));
  } catch (err) {
    throw new Error(`AGENTS.md: ${err.message}`, { cause: err });
  }
}

const entries = taggedEntries();
const check = process.argv.includes('--check');
writeOrCheck([[AGENTS, agentsWithList(entries)]], { check, tool: 'one-way', command: 'pnpm docs:one-way' });
if (!check) console.log(`[one-way] wrote ${entries.length} helpers.`);
