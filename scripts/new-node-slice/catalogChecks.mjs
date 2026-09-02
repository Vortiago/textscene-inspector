/**
 * Checking a name against ClassDB, which is the one thing the derivation cannot
 * do for itself: a type Godot does not know gets no base and therefore no
 * inherited validation, silently.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, fail } from './paths.mjs';

/**
 * The node catalog `pnpm nodes:catalog` derived from Godot's own ClassDB.
 *
 * Read once: three checks below ask it questions and the file does not change
 * inside one invocation.
 */
let cached;
function loadCatalog() {
  cached ??= JSON.parse(
    readFileSync(join(REPO_ROOT, 'scripts/compare-docs/node-catalog.json'), 'utf8')
  );
  return cached;
}

/**
 * Check a `--tier` name against ClassDB, and report who inherits from it.
 *
 * The opposite check from `checkChain`: an abstract class is by definition NOT
 * instantiable, so it is absent from the catalog's node list and present only
 * inside other types' `chain` arrays. A tier keyed on a name Godot never had
 * registers validators nothing can inherit, and nothing fails, so the spelling
 * check matters more here than for a leaf.
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
 * The tier's OWN parent: the hop after it in any heir's catalogued chain.
 *
 * An abstract class is absent from `catalog.nodes` — `checkTier` asserts as
 * much — so it has no chain of its own to read. Its heirs do, and every one of
 * them passes through it, so the entry after `typeName` in any of their chains
 * is the class directly above the tier.
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
 * The type's parent, from Godot's own answer in the node catalog.
 *
 * `NODE_BASE_TYPES` is derived from that catalog, so nothing needs writing —
 * the entry for a real Godot type is already there. What the lookup still buys
 * is the one failure the derivation cannot catch: a type name that is not a
 * Godot type at all. A misspelled `Raycast3D` gets no catalog entry, so it gets
 * no base, so the validator walk terminates instantly and the slice is silently
 * unvalidated. Refusing the name here turns that into an error rather than a
 * green scaffold with zero inherited validation.
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
