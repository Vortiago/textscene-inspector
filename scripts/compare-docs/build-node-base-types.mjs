/**
 * Derives the linter's class → base-type tables from the engine captures and
 * writes them as TypeScript modules — one for the Node hierarchy, one for the
 * Resource hierarchy.
 *
 * Usage:
 *   pnpm nodes:base-types      # -> packages/textscene-core/src/linter/{node,resource}BaseTypes.generated.ts
 *
 * The catalog stores each node's full `chain` up to `Object`, so every hop in
 * it is a fact from Godot's own ClassDB rather than a judgement call. Emitting
 * one entry per hop — including the abstract classes that are only ever seen
 * as somebody's ancestor — is what makes the base-walk reach a validator the
 * day it is registered on an intermediate, instead of the day somebody
 * remembers to re-point every leaf at it.
 *
 * The Resource side arrives already flattened to one hop per class
 * (`resource-bases.json`), because the catalog's `chain` covers instantiable
 * NODE classes only and every class that declares a material or mesh property
 * is abstract.
 *
 * Reads the committed captures, never Godot: CI has no engine, and the test
 * beside this file re-derives from the same inputs to prove both committed
 * outputs are current.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
export const CATALOG = join(here, 'node-catalog.json');
export const RESOURCE_BASES = join(here, 'resource-bases.json');

/** `src/godot/<name>` in the core package. */
function godotModule(name) {
  return join(here, '..', '..', 'packages', 'textscene-core', 'src', 'godot', name);
}

export const OUT = godotModule('nodeBaseTypes.generated.ts');
export const RESOURCE_OUT = godotModule('resourceBaseTypes.generated.ts');

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

/** One `Child: 'Parent',` line per entry, in the object literal's indentation. */
function renderEntries(table) {
  return Object.entries(table)
    .map(([child, parent]) => `  ${child}: '${parent}',`)
    .join('\n');
}

/**
 * The module source for a derived table.
 *
 * @param table - output of {@link deriveBaseTypes}.
 * @param version - the catalog's Godot version, quoted in the header so a
 *   reader can tell which engine the ancestry came from.
 */
export function renderModule(table, version) {
  const entries = renderEntries(table);
  return `/**
 * Node-type → base-type table, derived from Godot ${version}'s ClassDB.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * One entry per hop of every catalogued node's ancestry, so abstract classes
 * that no scene can instantiate still appear as somebody's base. \`Node\` is the
 * terminal and has no entry. Merged with the hand-written exceptions in
 * nodeBaseTypes.ts, which is what every domain imports.
 */

export const CATALOG_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
${entries}
});
`;
}

/**
 * The module source for the Resource hierarchy.
 *
 * The engine emits this one already flattened, so there is no chain to walk and
 * nothing to derive — the value here is the same as the node module's: a table
 * the linter can import, checked in because CI has no engine.
 *
 * @param table - `resource-bases.json`, class → immediate base.
 * @param version - the engine both captures came from.
 */
export function renderResourceModule(table, version) {
  return `/**
 * Resource-type → base-type table, derived from Godot ${version}'s ClassDB.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Every Resource class, instantiable or not and property-declaring or not:
 * \`StandardMaterial3D\` declares nothing and \`BaseMaterial3D\`, which declares
 * the material properties, is abstract, so a table filtered on either would
 * break the one chain a scene names. \`Resource\` is the terminal and has no
 * entry. ValidatorRegistry.ts merges it with the node table to build the walk.
 */

export const RESOURCE_BASE_TYPES_GENERATED: Readonly<Record<string, string>> = Object.freeze({
${renderEntries(table)}
});
`;
}

/** The module source the committed artifact must equal. */
export function renderFromCatalog() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  return renderModule(deriveBaseTypes(catalog.nodes), catalog.godotVersion ?? 'unknown');
}

/**
 * The Resource module the committed artifact must equal.
 *
 * The version comes from the catalog because the two captures are written by
 * one engine run; `resource-bases.json` is a bare map with nowhere to put it.
 */
export function renderFromResourceBases() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  return renderResourceModule(
    JSON.parse(readFileSync(RESOURCE_BASES, 'utf8')),
    catalog.godotVersion ?? 'unknown'
  );
}

// Only write when run as a CLI, so the test can import the derivation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [path, source] of [
    [OUT, renderFromCatalog()],
    [RESOURCE_OUT, renderFromResourceBases()],
  ]) {
    writeFileSync(path, source);
    const count = source.match(/^ {2}\w+: '/gm)?.length ?? 0;
    console.log(`Wrote ${path} — ${count} base-type entries.`);
  }
}
