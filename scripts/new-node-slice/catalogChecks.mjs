/**
 * Checks a name against ClassDB, which the base derivation cannot do for itself: a type Godot does
 * not know gets no base and so, silently, no inherited validation.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, fail } from './paths.mjs';

/** The node catalog `pnpm nodes:catalog` derived from ClassDB, read once per invocation. */
let cached;
function loadCatalog() {
  cached ??= JSON.parse(
    readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8')
  );
  return cached;
}

/**
 * Checks a `--tier` name against ClassDB. An abstract class is absent from the catalog's node list
 * and present only in other types' `chain` arrays. A tier on a name Godot never had registers
 * validators nothing inherits, and nothing else fails.
 *
 * @returns the concrete catalogued types that would inherit the tier.
 */
export function checkTier(typeName) {
  const catalog = loadCatalog();
  if (catalog.nodes.some((n) => n.name === typeName)) {
    fail(
      `${typeName} is instantiable, so it is a node type, not an abstract tier. ` +
        `Scaffold it as an ordinary slice: drop --tier and pass --intent.`
    );
  }
  const heirs = catalog.nodes.filter((n) => (n.chain ?? []).includes(typeName)).map((n) => n.name);
  if (heirs.length === 0) {
    fail(
      `No catalogued type descends from ${typeName}, so a tier keyed on it would ` +
        `register validators nothing inherits. Check the spelling against ClassDB.`
    );
  }
  return heirs;
}

/**
 * The tier's own parent: the hop after it in any heir's catalogued chain. An abstract class has no
 * chain of its own in `catalog.nodes`, but every heir's chain passes through it.
 */
export function tierParent(typeName) {
  const catalog = loadCatalog();
  for (const node of catalog.nodes) {
    const chain = node.chain ?? [];
    const at = chain.indexOf(typeName);
    if (at !== -1 && chain[at + 1]) return chain[at + 1];
  }
  return undefined;
}

/**
 * The type's parent from the node catalog, which `NODE_BASE_TYPES` already derives. The lookup
 * refuses a name that is not a Godot type: a misspelled `Raycast3D` would get no base, and the
 * slice would be scaffolded green with zero inherited validation.
 */
export function checkChain(typeName) {
  const catalog = loadCatalog();
  const entry = catalog.nodes.find((n) => n.name === typeName);
  if (!entry) {
    fail(
      `${typeName} is not in scripts/compare-docs/node-catalog.json, so NODE_BASE_TYPES ` +
        `has no base for it and every inherited validator would silently skip the type. ` +
        `Check the spelling, or add it to UNCATALOGUED in godot/nodeBaseTypes.ts with a reason.`
    );
  }
  const parent = entry.chain?.[0];
  if (!parent) fail(`${typeName} has no parent in the catalog, so nothing can be inherited from.`);
  return { parent, note: `${typeName} → ${parent} (derived, already in godot/nodeBaseTypes.generated.ts)` };
}
