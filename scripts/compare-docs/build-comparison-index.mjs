/**
 * Write the node index in `docs/comparison/README.md` from the sheets.
 *
 * Each row restates its sheet's `renders_as:`, so the list is generated rather
 * than kept by hand. `sheets.test.mjs` checks only that every type is PRESENT,
 * never that its description is current, which is why a hand-kept list drifted
 * without failing anything.
 *
 * `--check` fails instead of writing, and `validate` runs it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSheetFiles, parseFrontmatter } from './sheetSources.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const INDEX = resolve(ROOT, 'docs/comparison/README.md');
const START = '## 3D';

/** `2D` before `3D` before the rest, and A-Z inside a category. */
const CATEGORY_ORDER = ['3D', '2D', 'Resources', 'Other'];

function rows() {
  const byCategory = new Map();
  for (const file of collectSheetFiles()) {
    const sheet = parseFrontmatter(readFileSync(file, 'utf8'));
    // Node types only: the showcase sheets describe scenes, not a type.
    if (!sheet?.meta?.type || !file.includes('/nodes/')) continue;
    const category = sheet.meta.category ?? 'Other';
    if (!byCategory.has(category)) byCategory.set(category, []);
    const href = relative(dirname(INDEX), file).replaceAll('\\', '/');
    const renders = (sheet.meta.renders_as ?? '').trim();
    byCategory.get(category).push(
      `- [${sheet.meta.type}](${href})${renders ? ` — ${renders}` : ''}`
    );
  }
  const out = [];
  const seen = [...byCategory.keys()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );
  for (const category of seen) {
    out.push(`## ${category}`, '');
    out.push(...byCategory.get(category).sort((a, b) => a.localeCompare(b)));
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}

const current = readFileSync(INDEX, 'utf8');
const cut = current.indexOf(START);
if (cut === -1) {
  console.error(`[comparison-index] ${START} not found in docs/comparison/README.md`);
  process.exit(1);
}
const next = current.slice(0, cut) + rows();

if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error('[comparison-index] docs/comparison/README.md is STALE — run `pnpm docs:index`.');
    process.exit(1);
  }
  console.log('[comparison-index] up to date.');
} else {
  writeFileSync(INDEX, next);
  console.log(`[comparison-index] wrote ${next.slice(cut).split('\n- ').length - 1} rows.`);
}
