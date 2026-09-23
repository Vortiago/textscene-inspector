/**
 * Scaffolds the shared validator tier of an abstract Godot class, which `NODE_BASE_TYPES` passes
 * on to its subclasses. A leaf that imports its linterParser pulls in a validators-only tier. A
 * `--rule` tier has no such consumer, so it needs `index.linter.ts` and a line in
 * `linter/index.ts`, or `ruleCoverage` reports the rule as never registered.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkTier, tierParent } from './catalogChecks.mjs';
import { parentLinterParser } from './ancestry.mjs';
import { CORE_SRC, REPO_ROOT, fail } from './paths.mjs';
import { tierFiles } from './templates/tier.mjs';
import { wireImport } from './wiring.mjs';

export function scaffoldTier({ typeName, category, rule, dryRun }) {
  const heirs = checkTier(typeName);

  // `<category>/shared` holds a category's only tier, as in 3d/lights and canvasitem. When it is
  // taken (2d/ui/shared holds parser helpers for four bases), the tier gets a directory named
  // after the class, so a category holds as many tiers as Godot has abstract classes.
  const sharedRel = `nodes/${category}/shared`;
  const taken = existsSync(join(CORE_SRC, sharedRel));
  const sliceRel = taken ? `nodes/${category}/${typeName.toLowerCase()}` : sharedRel;
  const sliceDir = join(CORE_SRC, sliceRel);
  if (!dryRun && existsSync(sliceDir)) fail(`tier already exists: ${sliceDir}`);
  const toSrc = '../'.repeat(sliceRel.split('/').length);

  // The leaf scaffold's resolution. Without it a tier registers unchained and fails
  // baseChainImport's reachability arm.
  const parentLinterImport = parentLinterParser(typeName, tierParent(typeName), sliceDir, null);

  const files = tierFiles({ typeName, heirs, toSrc, rule, parentLinterImport });

  const wirings = rule
    ? [wireImport(join(CORE_SRC, 'linter/index.ts'), `import '../${sliceRel}/index.linter.js';`, `'../nodes/${category}/`)]
    : [];

  console.log(`[new-node-slice] ${typeName} tier -> ${sliceRel}${rule ? ' (with family rule)' : ' (validators only)'}`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);
  if (parentLinterImport) console.log(`  inherit ${parentLinterImport}`);
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
