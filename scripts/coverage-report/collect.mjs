/**
 * The coverage ledger itself: what the live registries know, measured against
 * Godot's own ClassDB as captured in `node-catalog.json`. Nothing is written
 * down, so nothing can drift.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCoreLinter, loadCoreParser } from '../compare-docs/loadCoreLinter.mjs';
import { baseClassesOf, byWave } from './waveOrder.mjs';

const CATALOG = join(import.meta.dirname, '../compare-docs/node-catalog.json');

/**
 * Godot 4.6.3 parses `AreaLight3D` but emits nothing from it, so the node
 * postdates that build and never appears in its ClassDB. It is implemented here
 * regardless; without this note it reads as a phantom registration.
 */
const NOT_IN_CLASSDB = new Set(['AreaLight3D']);

export async function collectCoverage() {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const { nodeRegistry } = await loadCoreParser();
  const { validatorRegistry, registeredTypes } = await loadCoreLinter();

  const registered = new Set(nodeRegistry.getAllTypeNames());
  // A registration entry is not coverage: a slice may call registerAll with an
  // empty map, which is correct for a type Godot gives no own members but
  // indistinguishable from a slice nobody finished. Count declared keys.
  const validated = new Set(
    registeredTypes('declaring')
      .filter((t) => validatorRegistry.getOwnKeys(t).length > 0)
  );

  // Registered by the parser, declaring nothing of its own. These read as
  // covered in the `registered` count while StrictTscnParser accepts every
  // value on them, so they are listed rather than left to be inferred.
  const undeclared = [...registered].filter((t) => !validated.has(t)).sort();

  const bases = baseClassesOf(catalog.nodes);
  const catalogued = new Set(catalog.nodes.map((n) => n.name));

  const missing = catalog.nodes
    .filter((n) => !registered.has(n.name))
    .map((n) => ({ ...n, isBase: bases.has(n.name) }))
    .sort(byWave);

  // A registration for a type Godot's ClassDB never listed is either a node
  // newer than the catalog's engine build or a typo; either way, say so.
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
