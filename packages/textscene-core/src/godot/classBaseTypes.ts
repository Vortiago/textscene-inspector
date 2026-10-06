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

/** The direct base of `className`, over both hierarchies. `Object.hasOwn`, as the `.tscn` chooses the key. */
function classBaseOf(className: string): string | undefined {
  return Object.hasOwn(CLASS_BASE_TYPES, className) ? CLASS_BASE_TYPES[className] : undefined;
}

/**
 * Whether `className` descends from or equals `ancestor`, over both hierarchies. `descendsFrom`
 * answers false for every resource, so an `[ext_resource type="…"]` heading needs this. A hop
 * bound guards against a malformed table.
 */
export function descendsFromClass(className: string, ancestor: string): boolean {
  let current: string | undefined = className;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (current === ancestor) return true;
    current = classBaseOf(current);
  }
  return false;
}

/** Every ancestor of `className`, nearest first, over both hierarchies. Cycle-safe and hop-bounded. */
export function classBaseChain(className: string): readonly string[] {
  const chain: string[] = [];
  const seen = new Set([className]);
  let current = classBaseOf(className);
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS && !seen.has(current); hops++) {
    seen.add(current);
    chain.push(current);
    current = classBaseOf(current);
  }
  return chain;
}
