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

import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

export const CLASS_BASE_TYPES: Readonly<Record<string, string>> = Object.freeze({
  ...NODE_BASE_TYPES,
  ...RESOURCE_BASE_TYPES_GENERATED,
});
