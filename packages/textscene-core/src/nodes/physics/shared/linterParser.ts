/**
 * Validators shared by every CollisionObject-derived node — the bodies
 * (`StaticBody`, `RigidBody`, `CharacterBody`, and their leaves) and the areas.
 *
 * Registered under the abstract keys `'CollisionObject2D'` and
 * `'CollisionObject3D'`, the shape `3d/lights/shared` uses for `Light3D` and
 * `canvasitem/shared` for `CanvasItem`. Neither is instantiable, so neither
 * appears in a `.tscn` and neither owns a slice; they exist here because
 * `NODE_BASE_TYPES` carries every hop of Godot's ancestry, so a validator
 * registered on an intermediate reaches its subclasses.
 *
 * `PhysicsBody2D` sits between `CollisionObject2D` and the concrete bodies and
 * binds no properties at all, so it gets no tier; `PhysicsBody3D` binds
 * `axis_lock_*` and owns `3d/shared/`.
 *
 * One owner, because copying these into each leaf is how they drift:
 * `collision_layer` and `collision_mask` reached four declarations per
 * dimension, and `disable_mode` four different answers across
 * seven types — bounded 0-1 on CharacterBody2D/RigidBody3D/CharacterBody3D
 * (rejecting the legal `KEEP_ACTIVE`), 0-2 on StaticBody3D and Area2D, and
 * absent on StaticBody2D and Area3D.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestors below are pulled
// in too; without them just the full barrel ever registers them.
import '../../base/node3d/linterParser.js';
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

/**
 * scene/2d/physics/collision_object_2d.cpp:652-654 and its 3D twin at :514-516
 * bind the same three constants; the 2D hint lives at :642, the 3D one at
 * :503, both "Remove,Make Static,Keep Active". Neither setter guards the
 * value (bare assignment), so out-of-range is hinted, not enforced.
 */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'MAKE_STATIC', 2: 'KEEP_ACTIVE' };

/**
 * The four keys both dimensions declare identically, minus the per-dimension
 * disable_mode hint.
 *
 * `collision_layer`/`collision_mask` go through the shared `layerBitmask()`
 * factory. No setter guards the value (collision_object_2d.cpp:142-161,
 * collision_object_3d.cpp:140-158), so the 32-bit width is the inspector's
 * checkbox grid rather than an engine limit: out of range is a warning.
 */
const shared = (disableModeHint: string, layerHint: string, maskHint: string) => ({
  disable_mode: v.enumInt('disable_mode', 0, 2, DISABLE_MODE, { hinted: disableModeHint }),
  // PROPERTY_HINT_LAYERS_{2D,3D}_PHYSICS: a 32-checkbox widget, so the width is
  // a UI-control hint and an out-of-range mask warns rather than errors.
  collision_layer: layerBitmask('collision_layer', { hinted: layerHint, width: 'uint32' /* collision_object_2d.h:121 / collision_object_3d.h:130 */ }),
  collision_mask: layerBitmask('collision_mask', { hinted: maskHint, width: 'uint32' /* collision_object_2d.h:124 / collision_object_3d.h:133 */ }),
  // collision_object_2d.cpp:647 — a plain FLOAT, no range hint, so no bound.
  collision_priority: v.float('collision_priority'),
});

validatorRegistry.registerAll('CollisionObject2D', {
  ...shared('collision_object_2d.cpp:642', 'collision_object_2d.cpp:645', 'collision_object_2d.cpp:646'),
  // collision_object_2d.cpp:650. The 3D twin spells it `input_ray_pickable`.
  input_pickable: v.boolean('input_pickable'),
});

validatorRegistry.registerAll('CollisionObject3D', {
  ...shared('collision_object_3d.cpp:503', 'collision_object_3d.cpp:506', 'collision_object_3d.cpp:507'),
  // collision_object_3d.cpp:511-512. `input_capture_on_drag` is 3D-only.
  input_ray_pickable: v.boolean('input_ray_pickable'),
  input_capture_on_drag: v.boolean('input_capture_on_drag'),
});
