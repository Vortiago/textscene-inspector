/**
 * The removal half of `ValidatorRegistry`: what a type takes away, and the rule that a key is
 * declared or removed, never both. Free functions over the registry's tables, so the class file
 * holds the storage and this one the walk. `removalKeys.md` defines a removal.
 */

import type { RegistryTables } from './validatorResolution.js';

/**
 * A registration is a declaration OR a removal. One type holding both for a
 * key hands `registeredKeys` the removal labelled a declaration, and the
 * grounding sweep a validator that never resolves.
 */
export function refuseOverlap(
  nodeType: string,
  keys: readonly string[],
  other: ReadonlyMap<string, Record<string, unknown>>,
  already: 'declares' | 'removes'
): void {
  const held = other.get(nodeType);
  if (!held) return;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(held, key)) {
      throw new Error(`${nodeType} already ${already} '${key}'; a key is declared or removed, never both`);
    }
  }
}

/**
 * Keys `nodeType` removes, declared here or inherited, resolved as
 * `findValidator` resolves them so a sheet never lists as unavailable a key the
 * linter accepts. A removal wins at its hop, and a nearer re-declaration takes
 * the key back.
 */
export function unavailableKeysOf(tables: RegistryTables, nodeType: string): string[] {
  const keys = new Set<string>();
  const reDeclared = new Set<string>();
  const visited = new Set<string>();
  let type: string | undefined = nodeType;
  while (type && !visited.has(type)) {
    visited.add(type);
    for (const key of Object.keys(tables.unavailable.get(type) ?? {})) {
      if (!reDeclared.has(key)) keys.add(key);
    }
    // One type never holds both (`refuseOverlap`), so the order within a hop
    // is immaterial; the set only shields the hops above this one.
    for (const key of Object.keys(tables.validators.get(type) ?? {})) reDeclared.add(key);
    type = tables.baseOf(type);
  }
  return [...keys];
}
