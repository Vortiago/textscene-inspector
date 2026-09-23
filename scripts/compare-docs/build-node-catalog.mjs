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
  OUT,
  PROPS_OUT,
  RESOURCE_BASES_OUT,
  RESOURCE_PROPS_OUT,
} from './build-node-catalog/paths.mjs';

const linksOnly = process.argv.includes('--links-only');
// The engine half alone: the property tables need a local godot, not the
// network, so a GitHub API outage or rate limit does not block them.
const propertiesOnly = process.argv.includes('--properties-only');
const previous = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf8'))
  : { nodes: [], resources: [], extras: [] };
const previousByName = new Map(
  [...(previous.nodes ?? []), ...(previous.resources ?? []), ...(previous.extras ?? [])].map((n) => [
    n.name,
    n,
  ])
);

/** One row per class, sorted so a regenerated file diffs by content not by order. */
function writeProperties(properties, out) {
  const sorted = Object.fromEntries(
    Object.entries(properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, props]) => [cls, [...props].sort((a, b) => a.name.localeCompare(b.name))])
  );
  writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`);
  const count = Object.values(sorted).reduce((sum, p) => sum + p.length, 0);
  console.log(`Wrote ${out} - ${Object.keys(sorted).length} classes, ${count} properties.`);
}

/** Every engine table from one enumeration, since one run yields them all. */
function writePropertyTables(enumerated) {
  writeProperties(enumerated.properties, PROPS_OUT);
  writeProperties(enumerated.resourceProperties, RESOURCE_PROPS_OUT);
  const bases = Object.fromEntries(
    Object.entries(enumerated.resourceBases).sort(([a], [b]) => a.localeCompare(b))
  );
  writeFileSync(RESOURCE_BASES_OUT, `${JSON.stringify(bases, null, 2)}\n`);
  console.log(`Wrote ${RESOURCE_BASES_OUT} - ${Object.keys(bases).length} classes.`);
}

if (propertiesOnly) {
  writePropertyTables(enumerateGodotNodes());
  process.exit(0);
}

let nodes;
let godotVersionValue;
if (linksOnly) {
  if (!previous.nodes?.length) throw new Error(`--links-only needs an existing ${OUT}`);
  // The links need only the network, the node list needs a local godot.
  nodes = previous.nodes.map((n) => {
    const copy = { ...n };
    delete copy.docs;
    delete copy.source;
    return copy;
  });
  if (!nodes.some((n) => n.chain?.length)) {
    throw new Error(
      `${OUT} predates persisted ancestry — run a full \`pnpm nodes:catalog\` once before --links-only.`
    );
  }
  godotVersionValue = previous.godotVersion ?? 'unknown';
} else {
  const supported = await supportedTypes();
  const enumerated = enumerateGodotNodes();
  writePropertyTables(enumerated);
  nodes = enumerated.classes
    // Editor-only plugins and engine-internal placeholders are not scene content.
    .filter((n) => !n.name.startsWith('Editor') && !n.name.endsWith('EditorPlugin') && n.name !== 'MissingNode')
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
writeFileSync(OUT, `${JSON.stringify(catalog, null, 2)}\n`);
const unsupported = linkedNodes.filter((n) => !n.supported).length;
const sourced = linkedNodes.filter((n) => n.source).length;
console.log(
  `Wrote ${OUT} — ${linkedNodes.length} nodes (${linkedNodes.length - unsupported} supported, ${unsupported} not implemented), ${sourced} with a verified source link, plus ${linkedResources.length} resources.`
);
