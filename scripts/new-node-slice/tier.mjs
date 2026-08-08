/**
 * Scaffold a shared validator tier for an abstract Godot class.
 *
 * A tier is not a slice: the class cannot be instantiated, so there is no
 * parser, no component, no fixture and no comparison sheet. It exists because
 * `NODE_BASE_TYPES` carries every hop of Godot's ancestry, so validators
 * registered on an intermediate reach its subclasses.
 *
 * `--rule` decides the wiring, and the distinction is the one the guards
 * already enforce: a tier carrying only validators is pulled in by whichever
 * leaf imports its linterParser, so it needs no barrel entry. A tier carrying a
 * RULE has no such consumer, so it needs `index.linter.ts` and a line in
 * `linter/index.ts`, or `ruleCoverage` reports the rule as declared-but-never-
 * registered.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTier } from './catalogChecks.mjs';
import { CORE_SRC, REPO_ROOT, fail } from './paths.mjs';
import { tierFiles } from './templates/tier.mjs';
import { wireImport } from './wiring.mjs';

export function scaffoldTier({ typeName, category, rule, dryRun }) {
  const heirs = checkTier(typeName);

  // `<category>/shared` is the home when the category has exactly one tier, as
  // 3d/lights and canvasitem do. It does not generalise: 2d/ui/shared already
  // holds parser helpers for four different bases, so a `linterParser.ts`
  // dropped in there would speak for one of them with nothing saying which, and
  // the next tier in the category would have nowhere to go. When the directory
  // is taken, the tier gets one named after the class instead — unambiguous,
  // and as many tiers per category as Godot has abstract classes.
  const sharedRel = `nodes/${category}/shared`;
  const taken = existsSync(join(CORE_SRC, sharedRel));
  const sliceRel = taken ? `nodes/${category}/${typeName.toLowerCase()}` : sharedRel;
  const sliceDir = join(CORE_SRC, sliceRel);
  if (!dryRun && existsSync(sliceDir)) fail(`tier already exists: ${sliceDir}`);
  const toSrc = '../'.repeat(sliceRel.split('/').length);

  const files = tierFiles({ typeName, heirs, toSrc, rule });

  const wirings = rule
    ? [wireImport(join(CORE_SRC, 'linter/index.ts'), `import '../${sliceRel}/index.linter.js';`, `'../nodes/${category}/`)]
    : [];

  console.log(`[new-node-slice] ${typeName} tier -> ${sliceRel}${rule ? ' (with family rule)' : ' (validators only)'}`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);
  console.log(`  heirs   ${heirs.length}: ${heirs.slice(0, 6).join(', ')}${heirs.length > 6 ? ', ...' : ''}`);
  if (!rule) {
    console.log('  note    validators-only tier: no barrel entry, each leaf imports ./linterParser.js');
  }

  if (dryRun) {
    console.log('[new-node-slice] dry run - nothing written.');
    return;
  }
  mkdirSync(sliceDir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(sliceDir, name), content);
  for (const w of wirings) if (w.content) writeFileSync(w.filePath, w.content);
  console.log(`[new-node-slice] done. Fill ${sliceRel}/linterParser.ts from doc/classes/${typeName}.xml, and list the keys in KEYS in its test.`);
}
