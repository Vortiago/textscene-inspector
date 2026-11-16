/**
 * Every class → base hop in one table, the node and resource hierarchies together, and the walks
 * over it: the linter resolves a validator, the theme lookup a type and the language features a
 * property through them. The hierarchies are disjoint under `Object`, and a test asserts it, since
 * a spread keeps the last of a colliding pair.
 */

import { CLASSDB_CLASSES } from './classList.generated.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

/**
 * How many hops a base-chain walk takes before giving up: the deepest catalogued chain is 7
 * (`OpenXRInteractionProfileEditor` → … → `Node`), and 32 never binds yet stops a malformed table.
 * Exported, as `ValidatorRegistry` walks the merged class table with the same bound.
 */
export const MAX_BASE_CHAIN_HOPS = 32;

export const CLASS_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...NODE_BASE_TYPES,
  ...RESOURCE_BASE_TYPES_GENERATED,
});

/** The direct base of `className`, over both hierarchies. `Object.hasOwn`, as the `.tscn` chooses the key. */
function classBaseOf(className: string): string | undefined {
  return Object.hasOwn(CLASS_BASE_TYPES, className) ? CLASS_BASE_TYPES[className] : undefined;
}

/**
 * The first answer `visit` gives for `className` or an ancestor, nearest first, over both
 * hierarchies, or `undefined`. The one walk over the table. It builds no chain, so a per-key lookup
 * stops at the first hop that answers. `undefined` from `visit` means no answer: any other value,
 * `false` and `null` included, ends the walk. A hop bound guards against a malformed table.
 */
export function findInClassChain<T>(
  className: string,
  visit: (type: string) => T | undefined
): T | undefined {
  let current: string | undefined = className;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    const found = visit(current);
    if (found !== undefined) return found;
    current = classBaseOf(current);
  }
  return undefined;
}

/**
 * Whether `className` descends from or equals `ancestor` in Godot's class tree, a node or a resource.
 * `RuleRegistry` matches `applicableNodeTypes` by exact name, so a rule for an inherited
 * `get_configuration_warnings` pairs `applicableNodeTypeMatcher` with this. A name test such as
 * `endsWith('3D')` is wrong for `NavigationAgent3D` (base `Node`) and for `GridMap` and `Decal`.
 */
export function descendsFromClass(className: string, ancestor: string): boolean {
  return findInClassChain(className, (type) => type === ancestor || undefined) ?? false;
}

/** `className`, then each ancestor nearest first, over both hierarchies. A repeated class ends it. */
function classAndBaseChain(className: string): string[] {
  const chain = new Set<string>();
  findInClassChain(className, (type) => (chain.has(type) ? true : void chain.add(type)));
  return [...chain];
}

/** Every ancestor of `className`, nearest first, over both hierarchies. Cycle-safe and hop-bounded. */
export function classBaseChain(className: string): readonly string[] {
  return classAndBaseChain(className).slice(1);
}

/** `ClassDB::class_exists` (class_db.cpp:463), editor classes included. */
export const classExists = (className: string): boolean => Object.hasOwn(CLASSDB_CLASSES, className);

// A node class newer than the 4.6.3 capture, such as AreaLight3D, takes its base from the node tables.
const directBase = (className: string): string =>
  classExists(className) ? CLASSDB_CLASSES[className]![0] : (classAndBaseChain(className)[1] ?? '');

/** `ClassDB::get_inheritance_chain_nocheck` (class_db.cpp:333): a class no table knows is alone. */
export function classInheritanceChain(className: string): readonly string[] {
  const chain = [className];
  for (let base = directBase(className); base !== ''; base = directBase(base)) chain.push(base);
  return chain;
}
