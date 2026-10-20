/**
 * The resource half of the coverage ledger: which classes of Godot's resource
 * catalog a Resource slice claims, and how many of their properties have a
 * validator. Read from the live registries, so nothing is written down.
 */

import { readFileSync } from 'node:fs';
import { RESOURCE_BASES_OUT, RESOURCE_PROPS_OUT } from '../compare-docs/build-node-catalog/paths.mjs';
import { loadCoreLinter, loadResourceClaims } from '../compare-docs/loadCoreLinter.mjs';
import { partitionByValidator } from '../compare-docs/registryKeys.mjs';

/**
 * One row per resource class, the work order first: most unvalidated properties
 * leading.
 *
 * `properties` maps a class to the properties it declares itself, `bases` maps a
 * class to its base, `claimed` holds the type names a slice claims, and
 * `ownKeysOf` returns a class's own validator keys. A class with no entry in
 * `properties`, such as `Noise`, declares nothing and has a zero row.
 */
export function buildResourceLedger({ properties, bases, claimed, ownKeysOf }) {
  // Pseudo-types a slice claims but ClassDB never lists (`GLB`) are not classes.
  const names = new Set([...Object.keys(properties), ...Object.keys(bases)]);
  const classes = [...names].map((name) => {
    const own = (properties[name] ?? []).map((p) => p.name);
    const ownKeys = ownKeysOf(name);
    const { validated } = partitionByValidator(own, ownKeys);
    return {
      name,
      base: bases[name] ?? null,
      claimed: claimed.has(name),
      ownKeys: ownKeys.length,
      ownProperties: own.length,
      validatedProperties: validated.length,
      unvalidatedProperties: own.length - validated.length,
    };
  });
  classes.sort((a, b) => b.unvalidatedProperties - a.unvalidatedProperties || a.name.localeCompare(b.name));

  return {
    total: classes.length,
    claimed: classes.filter((c) => c.claimed).length,
    withOwnValidator: classes.filter((c) => c.ownKeys > 0).length,
    classes,
  };
}

export async function collectResourceCoverage() {
  const readCatalog = (file) => JSON.parse(readFileSync(file, 'utf8'));
  const { validatorRegistry } = await loadCoreLinter();
  const { resourceSliceRegistry } = await loadResourceClaims();

  return buildResourceLedger({
    properties: readCatalog(RESOURCE_PROPS_OUT),
    bases: readCatalog(RESOURCE_BASES_OUT),
    claimed: new Set(resourceSliceRegistry.all().flatMap((slice) => slice.typeNames)),
    ownKeysOf: (name) => validatorRegistry.getOwnKeys(name),
  });
}
