/**
 * Derives the linter's node-type → base-type table from the node catalog's
 * ancestry and writes it as a TypeScript module.
 *
 * Usage:
 *   pnpm nodes:base-types      # -> packages/textscene-core/src/linter/nodeBaseTypes.generated.ts
 *
 * The catalog stores each node's full `chain` up to `Object`, so every hop in
 * it is a fact from Godot's own ClassDB rather than a judgement call. Emitting
 * one entry per hop — including the abstract classes that are only ever seen
 * as somebody's ancestor — is what makes the base-walk reach a validator the
 * day it is registered on an intermediate, instead of the day somebody
 * remembers to re-point every leaf at it.
 *
 * Reads the committed `node-catalog.json`, never Godot: CI has no engine, and
 * `nodeBaseTypes.sync.test.ts` re-derives from the same file to prove the
 * committed output is current.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
export const CATALOG = join(here, 'node-catalog.json');
export const OUT = join(
  here,
  '..',
  '..',
  'packages',
  'textscene-core',
  'src',
  'linter',
  'nodeBaseTypes.generated.ts'
);

/**
 * Node-type → immediate-base map covering every class the catalog's ancestry
 * mentions. `Node` is the terminal (it gets no entry) and `Object` is dropped:
 * it is not a node, and the walk must stop somewhere concrete.
 *
 * @param nodes - `node-catalog.json`'s `nodes` array.
 * @returns the derived table, keys sorted so the output diff is stable.
 */
export function deriveBaseTypes(nodes) {
  const derived = new Map();
  for (const node of nodes) {
    const chain = [node.name, ...(node.chain ?? [])];
    for (let i = 0; i < chain.length - 1; i++) {
      const child = chain[i];
      const parent = chain[i + 1];
      if (child === 'Node' || parent === 'Object') continue;
      const existing = derived.get(child);
      if (existing !== undefined && existing !== parent) {
        throw new Error(
          `${child} has two different bases in the catalog: '${existing}' and '${parent}'`
        );
      }
      derived.set(child, parent);
    }
  }
  return Object.fromEntries([...derived].sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * The module source for a derived table.
 *
 * @param table - output of {@link deriveBaseTypes}.
 * @param version - the catalog's Godot version, quoted in the header so a
 *   reader can tell which engine the ancestry came from.
 */
export function renderModule(table, version) {
  const entries = Object.entries(table)
    .map(([child, parent]) => `  ${child}: '${parent}',`)
    .join('\n');
  return `/**
 * Node-type → base-type table, derived from Godot ${version}'s ClassDB.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * One entry per hop of every catalogued node's ancestry, so abstract classes
 * that no scene can instantiate still appear as somebody's base. \`Node\` is the
 * terminal and has no entry. Merged with the hand-written exceptions in
 * nodeBaseTypes.ts, which is what the linter imports.
 */

export const CATALOG_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
${entries}
});
`;
}

/** The module source the committed artifact must equal. */
export function renderFromCatalog() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  return renderModule(deriveBaseTypes(catalog.nodes), catalog.godotVersion ?? 'unknown');
}

// Only write when run as a CLI, so the test can import the derivation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = renderFromCatalog();
  writeFileSync(OUT, source);
  const count = source.match(/^ {2}\w+: '/gm)?.length ?? 0;
  console.log(`Wrote ${OUT} — ${count} base-type entries.`);
}
