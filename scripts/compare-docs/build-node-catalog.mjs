#!/usr/bin/env node
/**
 * Builds the catalog that puts every Godot node, supported or not, in the menu:
 *   pnpm nodes:catalog        # -> scripts/compare-docs/node-catalog.json
 * The node list is ClassDB, read with a local `godot` and `xvfb-run`. Run
 * `pnpm --filter @textscene/core build` first: "supported" is the live registry.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { enumerateGodotNodes, godotVersion, supportedTypes } from './build-node-catalog/classdb.mjs';
import { EXTRA_CLASSES, RESOURCE_CLASSES } from './build-node-catalog/extraClasses.mjs';
import { groupOf } from './build-node-catalog/groups.mjs';
import { attachLinks } from './build-node-catalog/links.mjs';
import {
  CATALOG_OUT,
  PROPS_OUT,
  RESOURCE_BASES_OUT,
  RESOURCE_GETTERS_OUT,
  RESOURCE_PROPS_OUT,
} from './build-node-catalog/paths.mjs';

const linksOnly = process.argv.includes('--links-only');
// The engine half alone: the property tables need a local godot, not the
// network, so a GitHub API outage or rate limit does not block them.
const propertiesOnly = process.argv.includes('--properties-only');
const previous = existsSync(CATALOG_OUT)
  ? JSON.parse(readFileSync(CATALOG_OUT, 'utf8'))
  : { nodes: [], resources: [], extras: [] };
const previousByName = new Map(
  [...(previous.nodes ?? []), ...(previous.resources ?? []), ...(previous.extras ?? [])].map((n) => [
    n.name,
    n,
  ])
);

const byName = (a, b) => a.localeCompare(b);

/** `object` with its keys sorted, so a regenerated file diffs by content not by order. */
function sortedByKey(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => byName(a, b)));
}

function writeJson(out, value) {
  writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`);
}

/** One row per class, each class's rows sorted by name. */
function writeProperties(properties, out) {
  const sorted = Object.fromEntries(
    Object.entries(sortedByKey(properties)).map(([className, rows]) => [
      className,
      [...rows].sort((a, b) => byName(a.name, b.name)),
    ])
  );
  writeJson(out, sorted);
  const count = Object.values(sorted).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Wrote ${out} - ${Object.keys(sorted).length} classes, ${count} properties.`);
}

/** Every engine table from one enumeration, since one run yields them all. */
function writeEngineTables(enumerated) {
  writeProperties(enumerated.properties, PROPS_OUT);
  writeProperties(enumerated.resourceProperties, RESOURCE_PROPS_OUT);
  const bases = sortedByKey(enumerated.resourceBases);
  writeJson(RESOURCE_BASES_OUT, bases);
  console.log(`Wrote ${RESOURCE_BASES_OUT} - ${Object.keys(bases).length} classes.`);
  writeGetters(enumerated.resourceGetters);
}

function writeGetters({ collections, variant_properties }) {
  const getters = {
    collections: Object.fromEntries(
      Object.entries(sortedByKey(collections)).map(([className, slots]) => [className, sortedByKey(slots)])
    ),
    variantProperties: Object.fromEntries(
      Object.entries(sortedByKey(variant_properties)).map(([className, names]) => [
        className,
        [...names].sort(byName),
      ])
    ),
  };
  writeJson(RESOURCE_GETTERS_OUT, getters);
  const classCount = (table) => Object.keys(table).length;
  console.log(
    `Wrote ${RESOURCE_GETTERS_OUT} - ${classCount(getters.collections)} classes with typed collections, ` +
      `${classCount(getters.variantProperties)} with Variant properties.`
  );
}

if (propertiesOnly) {
  writeEngineTables(enumerateGodotNodes());
  process.exit(0);
}

let nodes;
let godotVersionValue;
if (linksOnly) {
  if (!previous.nodes?.length) throw new Error(`--links-only needs an existing ${CATALOG_OUT}`);
  // The links need only the network, the node list needs a local godot.
  nodes = previous.nodes.map((n) => {
    const copy = { ...n };
    delete copy.docs;
    delete copy.source;
    return copy;
  });
  if (!nodes.some((n) => n.chain?.length)) {
    throw new Error(
      `${CATALOG_OUT} predates persisted ancestry — run a full \`pnpm nodes:catalog\` once before --links-only.`
    );
  }
  godotVersionValue = previous.godotVersion ?? 'unknown';
} else {
  const supported = await supportedTypes();
  const enumerated = enumerateGodotNodes();
  writeEngineTables(enumerated);
  nodes = enumerated.classes
    // Editor-only plugins and engine-internal placeholders are not scene content.
    .filter(
      (n) => !n.name.startsWith('Editor') && !n.name.endsWith('EditorPlugin') && n.name !== 'MissingNode'
    )
    .map((n) => ({
      name: n.name,
      category: n.dim,
      group: groupOf(n),
      supported: supported.has(n.name),
      chain: n.chain,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  godotVersionValue = godotVersion();
}

// One pass over everything: each `attachLinks` call downloads the source tree,
// starts its own header cache and spends the 60/hour API budget.
const extras = EXTRA_CLASSES.filter((e) => !nodes.some((n) => n.name === e.name));
const linked = await attachLinks([...nodes, ...RESOURCE_CLASSES, ...extras], previousByName);
const linkedNodes = linked.slice(0, nodes.length);
const linkedResources = linked.slice(nodes.length, nodes.length + RESOURCE_CLASSES.length);
const linkedExtras = linked.slice(nodes.length + RESOURCE_CLASSES.length);

const catalog = {
  godotVersion: godotVersionValue,
  generated: 'pnpm nodes:catalog',
  nodes: linkedNodes,
  resources: linkedResources,
  extras: linkedExtras,
};
writeFileSync(CATALOG_OUT, `${JSON.stringify(catalog, null, 2)}\n`);
const unsupported = linkedNodes.filter((n) => !n.supported).length;
const sourced = linkedNodes.filter((n) => n.source).length;
console.log(
  `Wrote ${CATALOG_OUT} — ${linkedNodes.length} nodes (${linkedNodes.length - unsupported} supported, ${unsupported} not implemented), ${sourced} with a verified source link, plus ${linkedResources.length} resources.`
);
