/**
 * Godot's node ancestry: every type → the base it derives from. The linter walks it in
 * `ValidatorRegistry.findValidator`, so a set on `Node3D` or `Control` reaches every subclass, and the
 * render path asks it too. Derived from the catalog's `chain` (`nodeBaseTypes.generated.ts`) with every
 * hop, so a validator on an intermediate such as `GeometryInstance3D` reaches its subclasses.
 */

import { CATALOG_BASE_TYPES } from './nodeBaseTypes.generated.js';

/**
 * Types Godot 4.6.3's ClassDB does not enumerate, each with its reason. An entry for a catalogued type
 * would shadow the engine's answer, which `linter/baseChainCompleteness.test.ts` rejects.
 */
const UNCATALOGUED: Readonly<Record<string, string>> = {
  // Added after the pinned build: the current class reference lists it under Light3D's "Inherited
  // By", and scenes name it (3d/lights/arealight3d). The catalog supplies it once the pin moves.
  AreaLight3D: 'Light3D',
};

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...CATALOG_BASE_TYPES,
  ...UNCATALOGUED,
});

export { UNCATALOGUED as UNCATALOGUED_BASE_TYPES };

/**
 * Whether Godot's ClassDB knows this class name. `Node` is the terminal, with no entry of its own.
 * `descendsFrom` returns false both for a known non-subclass and for an unknown class, and a rule
 * that conflates them judges the hierarchy of a GDExtension it cannot see.
 */
export function isCatalogedType(nodeType: string): boolean {
  return nodeType === 'Node' || Object.hasOwn(NODE_BASE_TYPES, nodeType);
}

/**
 * How many hops a base-chain walk takes before giving up: the deepest catalogued chain is 7
 * (`OpenXRInteractionProfileEditor` → … → `Node`), and 32 never binds yet stops a malformed table.
 * Exported, as `ValidatorRegistry` walks the merged class table with the same bound.
 */
export const MAX_BASE_CHAIN_HOPS = 32;

/**
 * The declared base of `nodeType`, or `undefined`. `Object.hasOwn`, as the `.tscn` chooses the key:
 * bare indexing answers a function for `type="constructor"` or `type="__proto__"`.
 */
function baseTypeOf(nodeType: string): string | undefined {
  return Object.hasOwn(NODE_BASE_TYPES, nodeType) ? NODE_BASE_TYPES[nodeType] : undefined;
}

/**
 * Whether `nodeType` descends from or equals `ancestor` in Godot's class tree. `RuleRegistry` matches
 * `applicableNodeTypes` by exact name, so a rule for an inherited `get_configuration_warnings` pairs
 * `applicableNodeTypeMatcher` with this. A name test such as `endsWith('3D')` is wrong for
 * `NavigationAgent3D` (base `Node`) and for `GridMap`, `Decal`, `ReflectionProbe` and `VoxelGI`.
 */
export function descendsFrom(nodeType: string, ancestor: string): boolean {
  // A hop counter, not a visited Set, which allocates on every call. The table is acyclic by
  // construction, and the bound only stops a malformed hand-built table.
  let current: string | undefined = nodeType;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (current === ancestor) return true;
    current = baseTypeOf(current);
  }
  return false;
}

/**
 * Every ancestor of `nodeType`, nearest first, excluding the type itself. Cycle-safe, so a malformed
 * table truncates. `nodeBaseTypes.test.ts` and `baseChainCompleteness.test.ts` do not use it: a guard
 * on the table must not read it through this helper.
 */
export function baseChain(nodeType: string): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([nodeType]);
  let current: string | undefined = baseTypeOf(nodeType);
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = baseTypeOf(current);
  }
  return chain;
}
