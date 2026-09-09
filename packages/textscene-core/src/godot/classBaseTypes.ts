/**
 * Every class → base hop the linter resolves a property against, both of
 * Godot's hierarchies in one table.
 *
 * A `.tscn` names types from both, and `StrictTscnParser` sends every property
 * of both through one `findValidator`. With the node table alone, a Resource's
 * validators had to sit on the leaf a scene happens to name, where they reached
 * neither the sibling inheriting the same set (`ORMMaterial3D` beside
 * `StandardMaterial3D`) nor a guard asking what `BaseMaterial3D` declares.
 *
 * The two hierarchies are disjoint branches under `Object`, so the merge cannot
 * lose an entry — asserted rather than assumed, since a spread would silently
 * keep the last of a colliding pair.
 */

import { MAX_BASE_CHAIN_HOPS, NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

export const CLASS_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...NODE_BASE_TYPES,
  ...RESOURCE_BASE_TYPES_GENERATED,
});

/**
 * Does `className` descend from (or equal) `ancestor`, over BOTH hierarchies?
 *
 * `descendsFrom` walks the node table alone, so it answers false for every
 * resource: `StandardMaterial3D` reaches `Material` only through the merged
 * one. A caller asking what a `[ext_resource type="…"]` heading names — the
 * type is a Resource, never a Node — needs this.
 *
 * `Object.hasOwn` and a hop bound for the same reasons `descendsFrom` states:
 * the key is a type name the `.tscn` chooses, and the bound only stops a
 * malformed table from spinning.
 */
export function descendsFromClass(className: string, ancestor: string): boolean {
  let current: string | undefined = className;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (current === ancestor) return true;
    current = Object.hasOwn(CLASS_BASE_TYPES, current) ? CLASS_BASE_TYPES[current] : undefined;
  }
  return false;
}
