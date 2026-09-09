/**
 * Scaffold a node-type vertical slice: its files, its fixture, its sheet and
 * the three aggregation imports that make the registrations reachable.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parentLinterParser, parentParser } from './ancestry.mjs';
import { BASES } from './bases.mjs';
import { checkChain } from './catalogChecks.mjs';
import { CORE_SRC, REPO_ROOT, fail } from './paths.mjs';
import { drawsFiles } from './templates/drawsSlice.mjs';
import { fixtureFor } from './templates/fixture.mjs';
import { linterFiles } from './templates/linterSlice.mjs';
import { reusedParserFiles } from './templates/reusedParser.mjs';
import { sheetFile } from './templates/sheet.mjs';
import { kebab, wireImport } from './wiring.mjs';

export function scaffoldSlice({ typeName, category, base: baseKey, intent, linter, dryRun }) {
  const { parent: chain, note: chainNote } = checkChain(typeName);
  // `draws` is the only intent that gets its own types/parser/Component; the
  // other two reuse the base parser, so the render half is deferred to whoever
  // implements it (decision: property knowledge lives in linterParser.ts).
  // True for BOTH `transform-only` and `pending` — it says "reuses the base
  // parser", not "draws nothing", which is why it is not named for either.
  const reusesBaseParser = intent !== 'draws';
  const base = BASES[baseKey];
  const lower = typeName.toLowerCase();
  const camel = typeName[0].toLowerCase() + typeName.slice(1);
  const kebabName = kebab(typeName);

  const sliceRel = `nodes/${category}/${lower}`;
  const sliceDir = join(CORE_SRC, sliceRel);
  // A dry run writes nothing, so an already-scaffolded slice is no obstacle to
  // printing its plan — and the contract tests below name real Godot types, all
  // of which get scaffolded eventually.
  if (!dryRun && existsSync(sliceDir)) fail(`slice already exists: ${sliceDir}`);
  // Beside it, not down at the write: bailing after the slice files land leaves
  // a directory nothing wired, no fixture, and `generate:fixtures` never run —
  // a half-scaffold the next invocation then refuses as "slice already exists".
  const fixtureName = `unit-${kebabName}.tscn`;
  const fixturePath = join(REPO_ROOT, 'scenes/fixtures', fixtureName);
  if (!dryRun && existsSync(fixturePath)) fail(`fixture already exists: ${fixturePath}`);

  const catDepth = category.split('/').length;
  const toSrc = '../'.repeat(catDepth + 2); // slice dir → src/
  const toBase = '../'.repeat(catDepth + 1) + base.dir; // slice dir → base slice

  // Reuse the nearest ancestor's typed parser, not the --base flag's: they
  // differ whenever a Godot ancestor owns a parser.ts, and taking the flag
  // silently discards every property that ancestor reads. Every intent, `draws`
  // included: its own parser DELEGATES to the reused one and its `types.ts`
  // aliases what that returns, so the flag would lose the same properties one
  // layer down (SoftBody3D under MeshInstance3D).
  const reusedParser = parentParser(typeName, sliceDir, {
    importPath: `${toBase}/parser`,
    fn: base.parser,
    propsType: base.propsType,
    typesPath: `${toBase}/types`,
  });
  // Resolved once: the same answer feeds the generated import and the plan line
  // below, and finding it walks the whole nodes/ tree.
  const parentLinterImport = linter
    ? parentLinterParser(typeName, chain, sliceDir, `${toBase}/linterParser.js`)
    : null;

  // relative-to-slice name → content, in the order the plan prints them.
  const files = reusesBaseParser
    ? reusedParserFiles({ typeName, lower, camel, intent, base, toSrc, toBase, reusedParser })
    : drawsFiles({ typeName, lower, camel, base, toSrc, toBase, reusedParser });

  if (linter) {
    for (const [name, content] of linterFiles({
      typeName, lower, chain, kebabName, base, toSrc, parentLinterImport,
    })) {
      files.set(name, content);
    }
  }

  const fixtureContent = fixtureFor(baseKey, typeName);

  const wirings = [
    wireImport(
      join(CORE_SRC, 'parser/TscnParser.ts'),
      `import '../${sliceRel}/index.js';`,
      `'../nodes/${category}/`
    ),
  ];
  // The badge is kept honest by `renderIntent`, not by the absent registration,
  // so a `pending` slice still wires its base — unless the base is `control`,
  // whose component lays out rather than passing through.
  if (files.has('index.r3f.ts')) {
    wirings.push(
      wireImport(
        join(CORE_SRC, 'r3f/nodes/index.ts'),
        `import '../../${sliceRel}/index.r3f';`,
        `'../../nodes/${category}/`
      )
    );
  }
  if (linter) {
    wirings.push(
      wireImport(
        join(CORE_SRC, 'linter/index.ts'),
        `import '../${sliceRel}/index.linter.js';`,
        `'../nodes/${category}/`
      )
    );
  }

  const imageBasename = fixtureName.replace(/\.tscn$/, '');
  files.set('comparison.md', sheetFile({ typeName, baseKey, intent, fixtureName, imageBasename }));

  console.log(`[new-node-slice] ${typeName} → ${sliceRel} (base: ${baseKey}, intent: ${intent}${linter ? ', linter' : ''})`);
  for (const name of files.keys()) console.log(`  create  ${sliceRel}/${name}`);
  console.log(`  create  scenes/fixtures/${fixtureName}`);
  for (const w of wirings) console.log(`  wire    ${w.filePath.slice(REPO_ROOT.length + 1)} (${w.action})`);
  console.log(`  chain   ${chainNote}`);
  console.log(`  parser  ${reusedParser.fn} from ${reusedParser.importPath}`);
  if (linter) {
    console.log(`  inherit ${parentLinterImport}`);
  }

  if (dryRun) {
    console.log('[new-node-slice] dry run — nothing written.');
    return;
  }

  mkdirSync(sliceDir, { recursive: true });
  for (const [name, content] of files) writeFileSync(join(sliceDir, name), content);
  writeFileSync(fixturePath, fixtureContent);
  for (const w of wirings) {
    if (w.content) writeFileSync(w.filePath, w.content);
  }

  execSync('pnpm generate:fixtures', { cwd: REPO_ROOT, stdio: 'inherit' });

  console.log(`[new-node-slice] done. Next steps:
  1. Write ${sliceRel}/linterParser.ts from the Godot source: every own member of
     doc/classes/${typeName}.xml, skipping any tagged \`overrides=\` (a default
     override, already validated on the parent) and any ADD_PROPERTY flagged
     PROPERTY_USAGE_NONE (never written to a .tscn). Quote the source line beside
     each numeric bound.
  2. Fill scenes/fixtures/${fixtureName} with every property you validate, at
     VALID values — fixtureLint requires zero errors on a unit-* fixture.
  3. pnpm docs:lint-sections — fills the sheet's generated Linting block, and
     rewrite the lenient-parser prose under it. CI checks both.
  4. pnpm --filter @textscene/core test -- ${lower} && npx eslint <changed files>
  5. pnpm build:linter && pnpm lint:tscn scenes/fixtures/${fixtureName}${
    intent === 'pending'
      ? `
  6. When someone renders it: add Component.tsx, point index.r3f.ts at it, drop
     \`renderIntent\`, and move the sheet off \`status: unimplemented\`.`
      : intent === 'transform-only'
        ? ''
        : `
  6. Uncomment \`image:\` in comparison.md, then pnpm recapture --only ${imageBasename}`
  }`);
}
