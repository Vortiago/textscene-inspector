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
  // Not in 4.6.3's ClassDB at all — it is an editor-authored light shape rather
  // than its own class, but scenes still name it (3d/lights/arealight3d).
  AreaLight3D: 'Light3D',
};

export const NODE_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...CATALOG_BASE_TYPES,
  ...UNCATALOGUED,
});

export { UNCATALOGUED as UNCATALOGUED_BASE_TYPES };
