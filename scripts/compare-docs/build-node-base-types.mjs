/**
 * Derives the linter's Node and Resource class → base-type tables from the committed engine
 * captures (`pnpm nodes:base-types` writes
 * packages/textscene-core/src/godot/{node,resource}BaseTypes.generated.ts). It never runs Godot:
 * CI has no engine, and the test beside it re-derives both outputs to prove them current.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const here = import.meta.dirname;
export const CATALOG = join(here, 'node-catalog.json');
export const RESOURCE_BASES = join(here, 'resource-bases.json');
export const NODE_PROPERTIES = join(here, 'node-properties.json');
export const RESOURCE_PROPERTIES = join(here, 'resource-properties.json');

/** `src/godot/<name>` in the core package. */
function godotModule(name) {
  return join(here, '..', '..', 'packages', 'textscene-core', 'src', 'godot', name);
}

export const OUT = godotModule('nodeBaseTypes.generated.ts');
export const RESOURCE_OUT = godotModule('resourceBaseTypes.generated.ts');
export const PROPERTIES_OUT = godotModule('classProperties.generated.ts');

/**
 * Refuses to write a table a walk cannot leave. Every consumer (`descendsFrom`, `baseChain`,
 * `ValidatorRegistry`, the gallery's coverage) bounds its own walk, so a cycle hangs none of them
 * but truncates a class's ancestry: the "zero inherited validation" this file prevents.
 */
function assertAcyclic(table, what) {
  for (const start of Object.keys(table)) {
    const seen = new Set([start]);
    for (let at = table[start]; at !== undefined; at = table[at]) {
      if (seen.has(at)) throw new Error(`${what} has a cycle: walking up from ${start} reaches ${at} twice`);
      seen.add(at);
    }
  }
  return table;
}

/**
 * Node-type → immediate-base map, one entry per ClassDB hop of each node's catalog `chain`,
 * abstract ancestors included, so the base-walk reaches a validator on an intermediate class the
 * day it is registered. `Node` is the terminal (it gets no entry) and `Object` is dropped: it is
 * not a node, and the walk must stop somewhere concrete.
 *
 * @param nodes - `node-catalog.json`'s `nodes` array.
 * @returns the derived table, keys sorted so the output diff is stable.
 */
export function deriveBaseTypes(nodes) {
  const derived = new Map();
  for (const node of nodes) {
    // A catalogued class with no ancestry lands in NODE_BASE_TYPES with no base and inherits
    // nothing, a silence the scaffold's catalog check cannot see, since the name is in the
    // catalog. Only `Node` itself has nowhere to go.
    if (node.name !== 'Node' && !node.chain?.length) {
      throw new Error(
        `${node.name} has no chain in the catalog, so it would receive no base and ` +
          `no inherited validator. Re-run \`pnpm nodes:catalog\` against a local Godot.`
      );
    }
    const chain = [node.name, ...(node.chain ?? [])];
    for (let i = 0; i < chain.length - 1; i++) {
      const child = chain[i];
      const parent = chain[i + 1];
      if (child === 'Node' || parent === 'Object') continue;
      const existing = derived.get(child);
      if (existing !== undefined && existing !== parent) {
        throw new Error(`${child} has two different bases in the catalog: '${existing}' and '${parent}'`);
      }
      derived.set(child, parent);
    }
  }
  return assertAcyclic(
    Object.fromEntries([...derived].sort(([a], [b]) => a.localeCompare(b))),
    'the derived node base-type table'
  );
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
 * The module source for the Resource hierarchy. `resource-bases.json` arrives flattened to one
 * hop per class, since the catalog's `chain` covers instantiable node classes only and every
 * class declaring a material or mesh property is abstract. So nothing is derived: it becomes an
 * importable table, checked in because CI has no engine.
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

/**
 * One class's property rows, each a `[name, type, hint, hint_string]` tuple in the
 * capture's own order. The tuple keeps the generated file near the two captures' size,
 * since every row ships to the VS Code host bundle for hover and completion.
 */
function renderPropertyRows(rows) {
  return rows
    .map(
      (row) =>
        `    [${JSON.stringify(row.name)}, ${row.type}, ${row.hint}, ${JSON.stringify(row.hint_string)}],`
    )
    .join('\n');
}

/**
 * The module source for the ClassDB property tables. One table per class that declares a
 * property of its own; an inherited property is found by walking the base chain, exactly as
 * the engine's `_get_property_list` does.
 *
 * @param nodeProperties - `node-properties.json`, class → own rows.
 * @param resourceProperties - `resource-properties.json`, class → own rows.
 * @param version - the catalog's Godot version.
 */
export function renderPropertiesModule(nodeProperties, resourceProperties, version) {
  const table = (name, properties) =>
    `export const ${name}: Readonly<Record<string, readonly ClassPropertyRow[]>> = Object.freeze({\n` +
    Object.entries(properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, rows]) => `  ${JSON.stringify(className)}: [\n${renderPropertyRows(rows)}\n  ],`)
      .join('\n') +
    `\n});\n`;

  return `/**
 * ClassDB property rows, derived from Godot ${version}'s ClassDB captures.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Each row is \`[name, Variant::Type, PropertyHint, hint_string]\`, the numbers
 * \`node-properties.json\` and \`resource-properties.json\` record. A class appears only
 * where it declares a property of its own: a reader finds an inherited property by walking
 * the base chain in \`nodeBaseTypes\` or \`classBaseTypes\`.
 */

export type ClassPropertyRow = readonly [name: string, type: number, hint: number, hintString: string];

${table('NODE_CLASS_PROPERTIES', nodeProperties)}
${table('RESOURCE_CLASS_PROPERTIES', resourceProperties)}`;
}

/** The property module the committed artifact must equal. */
export function renderFromPropertyCaptures() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const nodeProperties = JSON.parse(readFileSync(NODE_PROPERTIES, 'utf8'));
  const resourceProperties = JSON.parse(readFileSync(RESOURCE_PROPERTIES, 'utf8'));
  return renderPropertiesModule(nodeProperties, resourceProperties, catalog.godotVersion ?? 'unknown');
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
  // Flattened, so unlike the node side no chain shape rules a cycle out. It is asserted here.
  const bases = assertAcyclic(JSON.parse(readFileSync(RESOURCE_BASES, 'utf8')), 'resource-bases.json');
  return renderResourceModule(bases, catalog.godotVersion ?? 'unknown');
}

// Only write when run as a CLI, so the test can import the derivation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const artifacts = [
    [OUT, renderFromCatalog(), (source) => `${source.match(/^ {2}\w+: '/gm)?.length ?? 0} base-type entries`],
    [
      RESOURCE_OUT,
      renderFromResourceBases(),
      (source) => `${source.match(/^ {2}\w+: '/gm)?.length ?? 0} base-type entries`,
    ],
    [
      PROPERTIES_OUT,
      renderFromPropertyCaptures(),
      (source) => `${source.match(/^\s*\["/gm)?.length ?? 0} property rows`,
    ],
  ];
  for (const [path, source, describe] of artifacts) {
    writeFileSync(path, source);
    console.log(`Wrote ${path} — ${describe(source)}.`);
  }
}
