/**
 * Derives the Node and Resource class → base-type tables and the ClassDB property tables from
 * the committed engine captures (`pnpm nodes:base-types` writes
 * packages/textscene-core/src/godot/classdb/{node,resource}BaseTypes.generated.ts,
 * classProperties.generated.ts, resourceTypeExclusions.generated.ts and
 * typedCollectionProperties.generated.ts). It never runs Godot: CI
 * has no engine, and the test beside it re-derives every output to prove it current.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';
import { PROPERTY_HINT } from '../../packages/textscene-core/src/godot/classdb/propertyHint.ts';
import { resourceTypeHint } from '../../packages/textscene-core/src/godot/classdb/resourceTypeHint.ts';
import {
  VARIANT_TYPE,
  variantTypeName,
} from '../../packages/textscene-core/src/godot/variant/variantType.ts';

const here = import.meta.dirname;
export const CATALOG = join(here, 'node-catalog.json');
export const RESOURCE_BASES = join(here, 'resource-bases.json');
export const NODE_PROPERTIES = join(here, 'node-properties.json');
export const RESOURCE_PROPERTIES = join(here, 'resource-properties.json');

/** `src/godot/classdb/<name>` in the core package. */
function classdbModule(name) {
  return join(REPO_ROOT, 'packages/textscene-core/src/godot/classdb', name);
}

export const OUT = classdbModule('nodeBaseTypes.generated.ts');
export const RESOURCE_OUT = classdbModule('resourceBaseTypes.generated.ts');
export const PROPERTIES_OUT = classdbModule('classProperties.generated.ts');
export const EXCLUSIONS_OUT = classdbModule('resourceTypeExclusions.generated.ts');
export const TYPED_COLLECTIONS_OUT = classdbModule('typedCollectionProperties.generated.ts');

/**
 * Refuses to write a table a walk cannot leave. Every consumer (`descendsFromClass`, `classBaseChain`,
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
function renderModule(table, version) {
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
function renderResourceModule(table, version) {
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

/** One frozen `class → rows` constant, its classes sorted so the output diff is stable. */
function renderPropertyTable(name, properties) {
  const classes = Object.entries(properties)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([className, rows]) => `  ${JSON.stringify(className)}: [\n${renderPropertyRows(rows)}\n  ],`)
    .join('\n');
  return (
    `export const ${name}: Readonly<Record<string, readonly ClassPropertyRow[]>> = Object.freeze({\n` +
    `${classes}\n});\n`
  );
}

/**
 * The module source for the ClassDB property tables. A class gets rows only where it declares a
 * property of its own. A reader finds an inherited property by walking the base chain, as the
 * engine's `_get_property_list` does.
 *
 * @param nodeProperties - `node-properties.json`, class → own rows.
 * @param resourceProperties - `resource-properties.json`, class → own rows.
 * @param version - the catalog's Godot version.
 */
function renderPropertiesModule(nodeProperties, resourceProperties, version) {
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

${renderPropertyTable('NODE_CLASS_PROPERTIES', nodeProperties)}
${renderPropertyTable('RESOURCE_CLASS_PROPERTIES', resourceProperties)}`;
}

/** Whether a resource hint excludes a class. */
function excludesAClass(row) {
  return row.hint === PROPERTY_HINT.RESOURCE_TYPE && resourceTypeHint(row.hint_string).excluded.length > 0;
}

/** A row's resource hint string, or `''` for another hint, which excludes nothing. */
function resourceHintOf(row) {
  return row.hint === PROPERTY_HINT.RESOURCE_TYPE ? row.hint_string : '';
}

/** Whether `className` declares `name` again below an ancestor whose slot of that name excludes a class. */
function redeclaresExcludingSlot(className, name, excludingByClass, bases) {
  for (let at = bases[className]; at !== undefined; at = bases[at]) {
    if (excludingByClass.get(at)?.has(name)) return true;
  }
  return false;
}

/**
 * Class → property → hint string, for each resource slot whose hint excludes a class and for each
 * nearer declaration of such a slot, under the class that declares it. The linter walks this
 * table alone, so a nearer row must be here for its hint to win. The full property table is too
 * large for the linter's bundles.
 *
 * @param properties - class → own rows, the node and resource captures merged.
 * @param bases - class → immediate base over both hierarchies, acyclic.
 */
export function deriveResourceTypeExclusions(properties, bases) {
  const excludingByClass = new Map(
    Object.entries(properties).map(([className, rows]) => [
      className,
      new Set(rows.filter(excludesAClass).map((row) => row.name)),
    ])
  );
  const exclusions = {};
  for (const className of Object.keys(properties).sort((a, b) => a.localeCompare(b))) {
    const kept = properties[className].filter(
      (row) => excludesAClass(row) || redeclaresExcludingSlot(className, row.name, excludingByClass, bases)
    );
    if (kept.length > 0)
      exclusions[className] = Object.fromEntries(kept.map((row) => [row.name, resourceHintOf(row)]));
  }
  return exclusions;
}

/**
 * The module source for the exclusion table.
 *
 * @param exclusions - output of {@link deriveResourceTypeExclusions}.
 * @param version - the catalog's Godot version.
 */
function renderExclusionsModule(exclusions, version) {
  const classes = Object.entries(exclusions)
    .map(([className, slots]) => {
      const rows = Object.entries(slots)
        .map(([name, hintString]) => `    ${JSON.stringify(name)}: ${JSON.stringify(hintString)},`)
        .join('\n');
      return `  ${JSON.stringify(className)}: {\n${rows}\n  },`;
    })
    .join('\n');
  return `/**
 * The resource slots whose \`PROPERTY_HINT_RESOURCE_TYPE\` hint excludes a class with a \`-\` prefix,
 * and each nearer declaration of such a slot, derived from Godot ${version}'s ClassDB captures.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Each entry is class → property → hint string, under the class that declares the property. A
 * reader finds an inherited slot by walking the base chain in \`classBaseTypes\`.
 */

export const RESOURCE_TYPE_EXCLUSIONS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
${classes}
});
`;
}

/** The hints whose hint string names the class of an Object element: a resource or a node type. */
const CLASS_NAMING_HINTS = new Set([PROPERTY_HINT.RESOURCE_TYPE, PROPERTY_HINT.NODE_TYPE]);

/**
 * The rows whose getter returns another collection than the hint names. The loader types a value
 * by the getter's value (`resource_format_binary.cpp:846-868`): `Shortcut::get_events` and
 * `DPITexture::get_color_map` return an untyped collection, which takes no prefix, and
 * `OggPacketSequence::get_packet_data` a `TypedArray<Array>`.
 */
const GETTER_COLLECTION_PREFIXES = new Map([
  ['Shortcut.events', undefined],
  ['DPITexture.color_map', undefined],
  ['OggPacketSequence.packet_data', 'Array[Array]'],
]);

/**
 * The type name Godot's text writer gives one element hint (`variant_parser.cpp:2262-2268,2363-2367`):
 * a bare type or class name, or `type/hint:hint_string`, whose resource or node hint names the class.
 */
function elementTypeName(elementHint, where) {
  const numbered = /^(\d+)\/(\d+):(.*)$/.exec(elementHint);
  if (!numbered) return elementHint;
  const [, type, hint, hintString] = numbered;
  if (Number(type) === VARIANT_TYPE.OBJECT) {
    return CLASS_NAMING_HINTS.has(Number(hint)) ? hintString : 'Object';
  }
  if (Number(type) === VARIANT_TYPE.NIL) return 'Variant';
  const name = variantTypeName(Number(type));
  if (name === undefined)
    throw new Error(`expected a Variant::Type number in the hint of ${where}, got ${type}`);
  return name;
}

/** The `Array[T]` or `Dictionary[K, V]` prefix of one row, or undefined for an untyped one. */
function typedCollectionText(row, where) {
  if (GETTER_COLLECTION_PREFIXES.has(where)) return GETTER_COLLECTION_PREFIXES.get(where);
  if (row.hint === PROPERTY_HINT.ARRAY_TYPE) return `Array[${elementTypeName(row.hint_string, where)}]`;
  if (row.hint !== PROPERTY_HINT.DICTIONARY_TYPE) return undefined;
  const [key, value] = row.hint_string.split(';');
  return `Dictionary[${elementTypeName(key, where)}, ${elementTypeName(value, where)}]`;
}

/**
 * Class → property → the `Array[T]` or `Dictionary[K, V]` prefix Godot's text writer puts on the
 * value, under the class that declares it. A binary file stores no element type: the loader types
 * a value as the property's getter types it (`resource_format_binary.cpp:846-868`), so a reader
 * needs this.
 *
 * @param properties - class → own rows.
 */
export function deriveTypedCollections(properties) {
  const typed = {};
  for (const className of Object.keys(properties).sort((a, b) => a.localeCompare(b))) {
    const slots = {};
    for (const row of properties[className]) {
      const text = typedCollectionText(row, `${className}.${row.name}`);
      if (text !== undefined) slots[row.name] = text;
    }
    if (Object.keys(slots).length > 0) typed[className] = slots;
  }
  return typed;
}

/** The module source for the typed collection table. */
function renderTypedCollectionsModule(typed, version) {
  const classes = Object.entries(typed)
    .map(([className, slots]) => {
      const rows = Object.entries(slots)
        .map(([name, text]) => `    ${JSON.stringify(name)}: ${JSON.stringify(text)},`)
        .join('\n');
      return `  ${JSON.stringify(className)}: {\n${rows}\n  },`;
    })
    .join('\n');
  return `/**
 * The resource properties whose value Godot types as \`Array[T]\` or \`Dictionary[K, V]\`, with the
 * prefix its text writer puts on the value, derived from Godot ${version}'s ClassDB captures.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm nodes:base-types
 *
 * Each entry is class → property → prefix, under the class that declares the property. A reader
 * finds an inherited property by walking the base chain in \`classBaseTypes\`.
 */

export const TYPED_COLLECTION_PROPERTIES: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({
${classes}
});
`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** The engine version a capture run recorded in the catalog. */
function godotVersionOf(catalog) {
  return catalog.godotVersion ?? 'unknown';
}

/** The typed collection module the committed artifact must equal. */
export function renderFromTypedCollectionCaptures() {
  const catalog = readJson(CATALOG);
  return renderTypedCollectionsModule(
    deriveTypedCollections(readJson(RESOURCE_PROPERTIES)),
    godotVersionOf(catalog)
  );
}

/** `resource-bases.json`, refused when cyclic. Flattened, so unlike the node side no chain shape rules a cycle out. */
function readResourceBases() {
  return assertAcyclic(readJson(RESOURCE_BASES), 'resource-bases.json');
}

/** The exclusion module the committed artifact must equal. */
export function renderFromExclusionCaptures() {
  const catalog = readJson(CATALOG);
  const properties = {
    ...readJson(NODE_PROPERTIES),
    ...readJson(RESOURCE_PROPERTIES),
  };
  const bases = { ...deriveBaseTypes(catalog.nodes), ...readResourceBases() };
  return renderExclusionsModule(deriveResourceTypeExclusions(properties, bases), godotVersionOf(catalog));
}

/** The property module the committed artifact must equal. */
export function renderFromPropertyCaptures() {
  const catalog = readJson(CATALOG);
  const nodeProperties = readJson(NODE_PROPERTIES);
  const resourceProperties = readJson(RESOURCE_PROPERTIES);
  return renderPropertiesModule(nodeProperties, resourceProperties, godotVersionOf(catalog));
}

/** The module source the committed artifact must equal. */
export function renderFromCatalog() {
  const catalog = readJson(CATALOG);
  return renderModule(deriveBaseTypes(catalog.nodes), godotVersionOf(catalog));
}

/**
 * The Resource module the committed artifact must equal.
 *
 * The version comes from the catalog because the two captures are written by
 * one engine run; `resource-bases.json` is a bare map with nowhere to put it.
 */
export function renderFromResourceBases() {
  const catalog = readJson(CATALOG);
  return renderResourceModule(readResourceBases(), godotVersionOf(catalog));
}

// Only write when run as a CLI, so the test can import the derivation.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const describeBaseTypes = (source) => `${source.match(/^ {2}\w+: '/gm)?.length ?? 0} base-type entries`;
  const describeProperties = (source) => `${source.match(/^\s*\["/gm)?.length ?? 0} property rows`;
  const describeNestedRows = (label) => (source) => `${source.match(/^ {4}"/gm)?.length ?? 0} ${label}`;
  const artifacts = [
    [OUT, renderFromCatalog(), describeBaseTypes],
    [RESOURCE_OUT, renderFromResourceBases(), describeBaseTypes],
    [PROPERTIES_OUT, renderFromPropertyCaptures(), describeProperties],
    [EXCLUSIONS_OUT, renderFromExclusionCaptures(), describeNestedRows('excluding slots')],
    [TYPED_COLLECTIONS_OUT, renderFromTypedCollectionCaptures(), describeNestedRows('typed collections')],
  ];
  for (const [path, source, describe] of artifacts) {
    writeFileSync(path, source);
    console.log(`Wrote ${path} — ${describe(source)}.`);
  }
}
