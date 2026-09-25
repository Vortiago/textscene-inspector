/**
 * The coverage ledger: what the live registries know, measured against Godot's
 * ClassDB in `node-catalog.json`. Nothing is written down, so nothing drifts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCoreLinter, loadCoreParser } from '../compare-docs/loadCoreLinter.mjs';

const CATALOG = join(import.meta.dirname, '../compare-docs/node-catalog.json');

/**
 * Types this repo implements that the 4.6.3 ClassDB never lists, so they are not
 * phantom registrations: Godot 4.6.3 parses `AreaLight3D` but emits nothing.
 */
const NOT_IN_CLASSDB = new Set(['AreaLight3D']);

export async function collectCoverage() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const { nodeRegistry } = await loadCoreParser();
  const { validatorRegistry, registeredTypes } = await loadCoreLinter();

  const registered = new Set(nodeRegistry.getAllTypeNames());
  // A registration entry is not coverage: an empty registerAll map is correct
  // for a type with no own members and also for an unfinished slice.
  const validated = new Set(
    registeredTypes('declaring')
      .filter((t) => validatorRegistry.getOwnKeys(t).length > 0)
  );

  // Registered by the parser, declaring nothing of its own, so StrictTscnParser
  // accepts every value on them.
  const undeclared = [...registered].filter((t) => !validated.has(t)).sort();

  const catalogued = new Set(catalog.nodes.map((n) => n.name));

  const missing = catalog.nodes
    .filter((n) => !registered.has(n.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  // A type ClassDB never listed is newer than the catalog's engine or a typo.
  const phantom = [...registered].filter((t) => !catalogued.has(t) && !NOT_IN_CLASSDB.has(t));

  return {
    godotVersion: catalog.godotVersion,
    total: catalog.nodes.length,
    registered: [...registered].sort(),
    validated: [...validated].sort(),
    undeclared,
    missing,
    phantom,
  };
}
