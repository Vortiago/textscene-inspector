/**
 * The edits a scaffold makes outside its own directory: naming a fixture, inserting an aggregation
 * import in the right group, and listing a slice the parity guard cannot see.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_SRC, fail } from './paths.mjs';

/** Marker3D to marker-3d, AudioStreamPlayer2D to audio-stream-player-2d. */
export function kebab(typeName) {
  const tokens = typeName.match(/[A-Z]+(?![a-z])|[A-Z][a-z]+|\d+[A-Za-z]?/g) ?? [typeName];
  return tokens.join('-').toLowerCase();
}

/**
 * Inserts an import line after the last import with the category prefix, which keeps the category
 * grouping, or else after the last import line.
 */
export function wireImport(filePath, importLine, categoryNeedle) {
  const src = readFileSync(filePath, 'utf8');
  if (src.includes(importLine)) return { filePath, action: 'already wired' };
  const lines = src.split('\n');
  let insertAt = -1;
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^import\s+'/.test(lines[i])) {
      lastImport = i;
      if (lines[i].includes(categoryNeedle)) insertAt = i;
    }
  }
  const at = (insertAt >= 0 ? insertAt : lastImport) + 1;
  if (at === 0) fail(`no import lines found in ${filePath}`);
  lines.splice(at, 0, importLine);
  return { filePath, action: `insert at line ${at + 1}`, content: lines.join('\n') };
}

const UNSWEPT_LIST_FILE = join(CORE_SRC, 'linter/testing/propertyGrammarParityUnswept.ts');
const UNSWEPT_LIST = /(export const UNSWEPT_SLICES[^\n]*\[\n)((?: {2}'[^']+',\n)*)(?=\];)/;

/**
 * `src` with the line of `slice` in the sorted `UNSWEPT_SLICES` list, or undefined when the list
 * names it already. The order is by code unit, as `unsweptListErrors` checks it.
 */
export function withUnsweptSlice(src, slice) {
  const list = UNSWEPT_LIST.exec(src);
  if (!list) throw new Error(`expected the UNSWEPT_SLICES list, got ${JSON.stringify(src.slice(0, 80))}`);
  const [whole, opening, body] = list;
  const line = `  '${slice}',`;
  const lines = body.split('\n').filter(Boolean);
  if (lines.includes(line)) return undefined;
  const sorted = [...lines, line].sort();
  return src.replace(whole, `${opening}${sorted.join('\n')}\n`);
}

/**
 * Lists the slice at `sliceRel` (`nodes/<category>/<name>`) as one with a `linterParser.ts` and no
 * parser of its own, which `propertyGrammarParity.test.ts` asks of each such slice.
 */
export function wireUnsweptSlice(sliceRel) {
  const slice = sliceRel.slice('nodes/'.length);
  const content = withUnsweptSlice(readFileSync(UNSWEPT_LIST_FILE, 'utf8'), slice);
  return content === undefined
    ? { filePath: UNSWEPT_LIST_FILE, action: 'already listed' }
    : { filePath: UNSWEPT_LIST_FILE, action: 'list the slice', content };
}
