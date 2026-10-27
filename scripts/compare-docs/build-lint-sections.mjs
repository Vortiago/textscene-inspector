#!/usr/bin/env node
/**
 * Writes each comparison sheet's `## Linting` block from the live linter registries, and the
 * same coverage for every unsupported node to `lint-coverage.json`. The gallery reads that file:
 * a matcher rule's reach is a predicate to execute, and build-gallery.mjs runs in the web build
 * before core is built. `--check` fails instead of writing when either is stale.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LINT_EXEMPT_CATEGORIES, collectSheetFiles, parseFrontmatter, sheetLabel } from './sheetSources.mjs';
import { loadClassBaseTypes, loadCoreLinter } from './loadCoreLinter.mjs';
import { coverageFor, renderCoverage } from './lintCoverage.mjs';
import { requireFreshDist } from '../distFreshness.mjs';
import { checkGenerated, replaceMarkedBlock, writeGenerated } from '../generatedFile.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { CATALOG_OUT } from './build-node-catalog/paths.mjs';

const COVERAGE_OUT = join(REPO_ROOT, 'scripts/compare-docs/lint-coverage.json');
const CORE = join(REPO_ROOT, 'packages/textscene-core');

const BEGIN = (type) => `<!-- lint:begin ${type} -->`;
const END = '<!-- lint:end -->';

/**
 * Replaces the marked block, or inserts a `## Linting` section before `## Known limitations` (a
 * sheet's closing note), else at the end. Only the block between the markers is generated: the
 * hand-written prose beneath it, on what the lenient parser does with a value strict rejects,
 * is never touched.
 */
function applyBlock(text, type, rendered) {
  // Any begin marker, not this type's: keying on `type:` leaves a renamed node's stale block in
  // place and appends a second `## Linting` section that never converges.
  const markers = [...text.matchAll(/<!-- lint:begin \S+ -->/g)];
  if (markers.length > 1) {
    throw new Error(`${type}: expected at most one lint:begin marker in the sheet, found ${markers.length}.`);
  }
  if (markers.length === 1) {
    const renamed = text.replace(markers[0][0], BEGIN(type));
    return replaceMarkedBlock(renamed, BEGIN(type), END, `${rendered}\n`);
  }
  const section = `## Linting\n\n${BEGIN(type)}\n${rendered}\n${END}\n`;
  // Anchored to a real heading: a plain indexOf would splice the section into
  // the middle of any paragraph that happens to mention "## Known limitations".
  const limitations = /^## Known limitations$/m.exec(text);
  if (limitations) {
    return `${text.slice(0, limitations.index)}${section}\n${text.slice(limitations.index)}`;
  }
  return `${text.replace(/\s*$/, '')}\n\n${section}`;
}

const check = process.argv.includes('--check');

// Both modes need a current core build (`pnpm --filter @textscene/core build`): a stale dist
// writes a previous revision's coverage into the committed sheets, and --check then certifies
// it. The message is printed, not thrown, so the remedy is the last line, not a stack frame.
try {
  requireFreshDist(CORE, 'the generated lint sections');
} catch (err) {
  console.error(`[lint-sections] ${err.message}`);
  process.exit(1);
}

const core = await loadCoreLinter();
const baseTypes = await loadClassBaseTypes();
const registries = {
  ruleRegistry: core.ruleRegistry,
  resourceRuleRegistry: core.resourceRuleRegistry,
  validatorRegistry: core.validatorRegistry,
  baseTypes,
};

// Loaded before the sheet loop so a sheet's `type:` can be checked against it.
const catalog = JSON.parse(readFileSync(CATALOG_OUT, 'utf8'));
const knownTypes = new Set(
  [...catalog.nodes, ...(catalog.resources ?? []), ...(catalog.extras ?? [])].map((n) => n.name)
);

const outputs = [];
let exempt = 0;

for (const file of collectSheetFiles()) {
  const text = readFileSync(file, 'utf8');
  const parsed = parseFrontmatter(text);
  if (!parsed) continue;
  const { meta } = parsed;
  if (LINT_EXEMPT_CATEGORIES.has(meta.category)) {
    exempt++;
    continue;
  }
  // An unknown type is a typo or a rename, not a node with no linting. coverageFor returns empty
  // validators for any string, so generating for it publishes a false "nothing is linted" chapter.
  if (!knownTypes.has(meta.type)) {
    throw new Error(
      `${sheetLabel(file)}: type "${meta.type}" is not a Godot node in node-catalog.json. ` +
        `Fix the frontmatter, or re-run \`pnpm nodes:catalog\` if the class is new.`
    );
  }
  outputs.push([
    file,
    applyBlock(text, meta.type, renderCoverage(meta.type, coverageFor(meta.type, registries))),
  ]);
}

// Every node the previewer does not implement, for the gallery's synthetic cards.
const unsupported = {};
for (const node of catalog.nodes.filter((n) => !n.supported)) {
  unsupported[node.name] = coverageFor(node.name, registries);
}
const payload = `${JSON.stringify({ generated: 'pnpm docs:lint-sections', unsupported }, null, 2)}\n`;
outputs.push([COVERAGE_OUT, payload]);

const report = {
  tool: 'lint-sections',
  summary: `${exempt} sheet(s) exempt, ${Object.keys(unsupported).length} unsupported node(s) in lint-coverage.json`,
};
if (check) checkGenerated(outputs, { ...report, command: 'pnpm docs:lint-sections' });
else writeGenerated(outputs, report);
