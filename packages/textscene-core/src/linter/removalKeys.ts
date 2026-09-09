/**
 * The removal half of `ValidatorRegistry`: what a type takes away, and the
 * rule that a key is declared or removed, never both.
 *
 * Free functions over the registry's tables rather than methods, so the class
 * file holds the storage and the public surface and this one the walk.
 */

/**
 * What a removal is — a type that REMOVES properties its base chain declares.
 *
 * The base-walk can only ever widen what a leaf accepts, so a class that
 * takes strictly less than its parent cannot be expressed by registering a
 * validator: whatever it registers still reads as "this key is allowed here".
 * `HBoxContainer` inherits `vertical` from `BoxContainer` and then fixes the
 * orientation, so `set_vertical` is `ERR_FAIL_COND_MSG(is_fixed, …)` AND
 * `_validate_property` clears the key to `PROPERTY_USAGE_NONE`.
 *
 * The setter guard is what makes it a removal. `_validate_property` alone is
 * not: it hides a key from the inspector and the saver while the setter still
 * accepts the write, so the value is inert rather than invalid and the key
 * stays inherited. `SpinBox.exp_edit` (spin_box.cpp:648, against
 * `Range::set_exp_ratio`'s unconditional assign at range.cpp:433) and
 * `FileDialog.dialog_text` are both that second shape, and neither is
 * registered as a removal.
 *
 * Modelling it as removal rather than as a rejecting validator is what lets
 * `getOwnKeys` leave the key out (it is not a declaration), the generated
 * sheet render it as unavailable rather than listing a forbidden key under
 * "Accepts", and the shadow guard stop carrying allowlist entries for what is
 * not a shadow.
 *
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
 * Keys `nodeType` removes, whether declared here or inherited.
 *
 * Resolved the same way `findValidator` resolves them, because the two answer
 * one question and a disagreement would put a key in a sheet's "unavailable"
 * list while the linter still accepted it: a removal wins at the hop that
 * declares it, but a NEARER type re-declaring the key takes it back.
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
