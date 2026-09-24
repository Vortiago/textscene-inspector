/**
 * The removal half of `ValidatorRegistry`: what a type takes away, and the rule
 * that a key is declared or removed, never both. Free functions over the
 * registry's tables, so the class file holds the storage and this one the walk.
 */

// A removal is a key a type takes away from its base chain, which a validator
// cannot express: the base-walk only widens. `HBoxContainer`'s `set_vertical` is
// `ERR_FAIL_COND_MSG(is_fixed, …)`, and that setter guard is what makes it one.
// It keeps the key out of `getOwnKeys`, "Accepts" and the shadow allowlist.

// `_validate_property` alone hides a key while the setter still accepts it, so
// the value is inert and the key stays inherited: `SpinBox.exp_edit`
// (spin_box.cpp:648, against `Range::set_exp_ratio` at range.cpp:433) and
// `FileDialog.dialog_text` are not removals.

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
