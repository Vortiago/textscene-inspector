/**
 * Canonical node-type → base-type table for the linter's validator inheritance.
 * `ValidatorRegistry.findValidator` walks this chain so a validator set
 * registered on `Node3D`, `CanvasItem`, `Control` or any other ancestor applies
 * to every subclass automatically, instead of each subclass silently escaping
 * validation.
 *
 * The table is Godot's own ancestry, derived from the catalog's `chain` field
 * (`nodeBaseTypes.generated.ts`) rather than hand-maintained. That matters
 * because the hand-written version modelled only the levels that carried
 * validators *at the time*, so every new validator tier — `GeometryInstance3D`,
 * `Range`, `BaseButton`, `BoxContainer`, `CanvasItem` — needed each of its
 * leaves re-pointed at it by hand, and a missed leaf lost the whole set
 * silently. With every hop present, registering a validator on an intermediate
 * is all it takes to reach its subclasses.
 *
 * Pure data: React/THREE-free, so it stays on the linter side of the bundle
 * boundary.
 */

import { CATALOG_BASE_TYPES } from './nodeBaseTypes.generated.js';

/**
 * Types Godot 4.6.3's ClassDB does not enumerate, so the catalog cannot supply
 * their base. Each entry needs a reason; an entry for a catalogued type would
 * shadow the engine's own answer, which `nodeBaseTypes.sync.test.ts` rejects.
 */
const UNCATALOGUED: Readonly<Record<string, string>> = {
  // A real class, added after the pinned build: 4.6.3's ClassDB does not know
  // it, and the current class reference lists it under Light3D's "Inherited By"
  // beside DirectionalLight3D / OmniLight3D / SpotLight3D. Scenes already name
  // it (3d/lights/arealight3d), so the hop is stated here until the pin moves
  // and the catalog supplies it.
  AreaLight3D: 'Light3D',
};

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...CATALOG_BASE_TYPES,
  ...UNCATALOGUED,
});

export { UNCATALOGUED as UNCATALOGUED_BASE_TYPES };

/**
 * Does `nodeType` descend from (or equal) `ancestor`, per Godot's class tree?
 *
 * `RuleRegistry` matches `applicableNodeTypes` by exact name, unlike
 * `ValidatorRegistry`, which walks this table. A rule mirroring a
 * `get_configuration_warnings` override therefore reaches only the class that
 * declares it, never the subclasses that inherit the warning, unless it pairs
 * `applicableNodeTypeMatcher` with this.
 *
 * Use it instead of a name heuristic. `nodeType.endsWith('3D')` was the earlier
 * approximation and disagrees with the real tree on 17 types: it claims
 * `NavigationAgent3D` (whose base is plain `Node`) and misses the 16 spatial
 * nodes Godot did not suffix, `GridMap`, `Decal`, `ReflectionProbe`, `VoxelGI`
 * and the OpenXR family among them.
 */
/**
 * Whether Godot's ClassDB knows this class name at all.
 *
 * `NODE_BASE_TYPES` carries one entry per hop of every catalogued node's
 * ancestry, so membership on either side of it IS catalog membership. `Node`
 * is the terminal and has no entry of its own, hence the explicit arm.
 *
 * The distinction matters because `descendsFrom` returns false for two
 * unrelated reasons — "known class, genuinely not a subclass" and "class this
 * build has never heard of" — and a rule that conflates them announces a
 * hierarchy verdict about a GDExtension it cannot see.
 */
export function isCatalogedType(nodeType: string): boolean {
  return nodeType === 'Node' || Object.hasOwn(NODE_BASE_TYPES, nodeType);
}

/**
 * How many hops the ancestry walks before giving up.
 *
 * Godot's deepest chain is 7; 32 is slack enough never to bind while still
 * terminating on a malformed hand-built table.
 */
const MAX_BASE_CHAIN_HOPS = 32;

/**
 * The declared base of `nodeType`, or `undefined`.
 *
 * `Object.hasOwn`, because the key is a type name the `.tscn` chooses: bare
 * indexing answers `Object` for `type="constructor"` and `Object.prototype` for
 * `type="__proto__"`, putting a function into a declared `string`.
 */
function baseTypeOf(nodeType: string): string | undefined {
  return Object.hasOwn(NODE_BASE_TYPES, nodeType) ? NODE_BASE_TYPES[nodeType] : undefined;
}

export function descendsFrom(nodeType: string, ancestor: string): boolean {
  // A hop counter, not a visited Set: this runs per node per ancestor test, and
  // the Set was an allocation on every call including every miss. The table is
  // derived from ClassDB ancestry and acyclic by construction; the bound only
  // stops a malformed hand-built table from spinning.
  let current: string | undefined = nodeType;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    if (current === ancestor) return true;
    current = baseTypeOf(current);
  }
  return false;
}

/**
 * Every ancestor of `nodeType`, nearest first, excluding the type itself.
 *
 * Cycle-safe, so a malformed table truncates rather than hanging. Consumers
 * that need the whole chain should use this rather than re-implementing the
 * loop; `nodeBaseTypes.test.ts` and `baseChainCompleteness.test.ts` are the
 * deliberate exceptions, since a guard on the table must not be written in
 * terms of a helper that reads the same table.
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
