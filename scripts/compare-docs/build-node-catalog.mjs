#!/usr/bin/env node
/**
 * Build the node catalog the comparison gallery uses to place EVERY Godot node —
 * supported or not — in the left menu, grouped by dimension (3D / 2D / Other) and
 * by what it does (lighting, physics, particles, UI, …). Unsupported nodes show
 * up in the gallery as "Not implemented" sheets; there is no separate list to
 * maintain.
 *
 *   pnpm nodes:catalog        # -> scripts/compare-docs/node-catalog.json
 *
 * The node list is Godot's own ClassDB (via enumerate-nodes.gd through the local
 * `godot` + `xvfb-run`), so re-running against a newer Godot picks up any nodes a
 * Godot update introduced. "Supported" is read from the live `nodeRegistry` in
 * the built package, so this needs `pnpm --filter @textscene/core build` first.
 * The functional grouping is derived from
 * each class's ancestor chain, so a new node auto-groups if it extends a known
 * base; a genuinely novel base falls to "Uncategorized" and wants a GROUP_RULES
 * entry.
 *
 * The parts live in `build-node-catalog/`: `classdb` (what Godot and the parser
 * each say exists), `groups` (the ancestry → menu-group table), `extraClasses`
 * (the documented classes ClassDB's node enumeration never yields), `links` (the
 * docs/source chips) and `paths`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { enumerateGodotNodes, godotVersion, supportedTypes } from './build-node-catalog/classdb.mjs';
import { EXTRA_CLASSES, RESOURCE_CLASSES } from './build-node-catalog/extraClasses.mjs';
import { groupOf } from './build-node-catalog/groups.mjs';
import { attachLinks } from './build-node-catalog/links.mjs';
import { OUT, PROPS_OUT } from './build-node-catalog/paths.mjs';

const linksOnly = process.argv.includes('--links-only');
// The engine half alone. Writing the property table needs a local godot and
// nothing else, while the catalog also re-verifies every docs/source link over
// the network, so refreshing the properties should not depend on the GitHub API
// being reachable or under its rate limit.
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

// `--links-only` refreshes the docs/source links against the existing catalog:
// the node list itself needs a local godot + xvfb-run, the links only need the
// network, and they go stale on different schedules.
/** One row per class, sorted so a regenerated file diffs by content not by order. */
function writeProperties(properties) {
  const sorted = Object.fromEntries(
    Object.entries(properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cls, props]) => [cls, [...props].sort((a, b) => a.name.localeCompare(b.name))])
  );
  writeFileSync(PROPS_OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  const count = Object.values(sorted).reduce((sum, p) => sum + p.length, 0);
  console.log(`Wrote ${PROPS_OUT} - ${Object.keys(sorted).length} classes, ${count} properties.`);
}

if (propertiesOnly) {
  writeProperties(enumerateGodotNodes().properties);
  process.exit(0);
}

let nodes;
let godotVersionValue;
if (linksOnly) {
  if (!previous.nodes?.length) throw new Error(`--links-only needs an existing ${OUT}`);
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
  writeProperties(enumerated.properties);
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

// One pass over everything: `attachLinks` downloads the ~4 MB source tree and
// starts a fresh header cache each time it runs, so three calls meant three
// downloads, three slices of the 60/hour API budget, and no cache sharing.
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
