/**
 * Godot's node ancestry: every type → the base it derives from. The linter walks it in
 * `ValidatorRegistry.findValidator`, so a set on `Node3D` or `Control` reaches every subclass, and the
 * render path asks it too. Derived from the catalog's `chain` (`nodeBaseTypes.generated.ts`) with every
 * hop, so a validator on an intermediate such as `GeometryInstance3D` reaches its subclasses.
 */

import { CATALOG_BASE_TYPES } from './nodeBaseTypes.generated.js';

/**
 * Types Godot 4.6.3's ClassDB does not enumerate, each with its reason. An entry for a catalogued type
 * that names another base would shadow the engine's answer, which `linter/baseChainCompleteness.test.ts`
 * rejects.
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

/**
 * Whether Godot's ClassDB knows this class name. `Node` is the terminal, with no entry of its own.
 * `descendsFromClass` returns false both for a known non-subclass and for an unknown class, and a rule
 * that conflates them judges the hierarchy of a GDExtension it cannot see.
 */
export function isCatalogedType(nodeType: string): boolean {
  return nodeType === 'Node' || Object.hasOwn(NODE_BASE_TYPES, nodeType);
}

/**
 * How many hops a base-chain walk takes before giving up: the deepest catalogued chain is 7
 * (`OpenXRInteractionProfileEditor` → … → `Node`), and 32 never binds yet stops a malformed table.
 * Exported, as `findInClassChain` and `ValidatorRegistry` walk the merged class table with the same
 * bound.
 */
export const MAX_BASE_CHAIN_HOPS = 32;
