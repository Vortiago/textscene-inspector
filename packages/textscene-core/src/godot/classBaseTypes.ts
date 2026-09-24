/**
 * Every class → base hop the linter resolves a property against, the node and resource
 * hierarchies in one table, so a Resource's validators sit on the class that declares them
 * (`BaseMaterial3D`). The hierarchies are disjoint under `Object`, and a test asserts it, since
 * a spread keeps the last of a colliding pair.
 */

import { MAX_BASE_CHAIN_HOPS, NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

export const CLASS_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...NODE_BASE_TYPES,
  ...RESOURCE_BASE_TYPES_GENERATED,
});

/**
 * Whether `className` descends from or equals `ancestor`, over both hierarchies. `descendsFrom`
 * answers false for every resource, so an `[ext_resource type="…"]` heading needs this.
 * `Object.hasOwn`, as the `.tscn` chooses the key, and a hop bound against a malformed table.
 */
export function descendsFromClass(className: string, ancestor: string): boolean {
  let current: string | undefined = className;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (current === ancestor) return true;
    current = Object.hasOwn(CLASS_BASE_TYPES, current) ? CLASS_BASE_TYPES[current] : undefined;
  }
  return false;
}
