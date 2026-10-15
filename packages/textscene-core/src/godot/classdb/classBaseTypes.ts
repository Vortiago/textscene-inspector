/**
 * Every class → base hop in one table, the node and resource hierarchies together, and the walks
 * over it: the linter resolves a validator, the theme lookup a type and the language features a
 * property through them. The hierarchies are disjoint under `Object`, and a test asserts it, since
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

/**
 * The hops above the classes the tables end on (`node.h:51`, `resource.h:54`, `ref_counted.h:37`).
 * The tables stop at `Node` and `Resource`, so `RefCounted` and `Object` have no entry there.
 */
const ROOT_BASE_TYPES: Readonly<Record<string, string>> = {
  Node: 'Object',
  Resource: 'RefCounted',
  RefCounted: 'Object',
};

function rootBaseOf(className: string): string | undefined {
  return Object.hasOwn(ROOT_BASE_TYPES, className) ? ROOT_BASE_TYPES[className] : undefined;
}

/**
 * `ClassDB::get_inheritance_chain_nocheck` (`core/object/class_db.cpp:333-354`): `className`, then
 * each ancestor through `Object`, nearest first. A class neither table knows yields only its name.
 */
export function classInheritanceChain(className: string): readonly string[] {
  const chain = [className, ...classBaseChain(className)];
  for (let base = rootBaseOf(chain.at(-1)!); base !== undefined; base = rootBaseOf(base)) chain.push(base);
  return chain;
}
