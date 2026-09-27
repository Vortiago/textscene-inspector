/**
 * Validators shared by every body and area, registered once under the abstract
 * keys `'CollisionObject2D'` and `'CollisionObject3D'`: `NODE_BASE_TYPES` walks
 * every hop of Godot's ancestry, so they reach each subclass. PhysicsBody2D binds
 * nothing, so it has no tier. PhysicsBody3D binds `axis_lock_*` in `3d/shared/`.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if these ancestors are imported too.
import '../../base/node3d/linterParser.js';
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

/**
 * scene/2d/physics/collision_object_2d.cpp:652-654 and its 3D twin at :514-516
 * bind the same three constants. The 2D hint lives at :642, the 3D one at
 * :503, both "Remove,Make Static,Keep Active". Neither setter guards the
 * value (bare assignment), so out-of-range is hinted, not enforced.
 */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'MAKE_STATIC', 2: 'KEEP_ACTIVE' };

/**
 * The keys both dimensions declare identically, apart from the disable_mode hint.
 * No layer or mask setter guards the value (collision_object_2d.cpp:142-161,
 * collision_object_3d.cpp:140-158), so the 32-bit width is the checkbox grid of
 * PROPERTY_HINT_LAYERS_{2D,3D}_PHYSICS, not an engine limit: out of range warns.
 */
const shared = (disableModeHint: string, layerHint: string, maskHint: string) => ({
  disable_mode: v.enumInt('disable_mode', 0, 2, DISABLE_MODE, { hinted: disableModeHint }),
  collision_layer: layerBitmask('collision_layer', { hinted: layerHint, width: 'uint32' /* collision_object_2d.h:121 / collision_object_3d.h:130 */ }),
  collision_mask: layerBitmask('collision_mask', { hinted: maskHint, width: 'uint32' /* collision_object_2d.h:124 / collision_object_3d.h:133 */ }),
  // collision_object_2d.cpp:647: a plain FLOAT, no range hint, so no bound.
  collision_priority: v.float('collision_priority'),
});

validatorRegistry.registerAll(
  'CollisionObject2D',
  shared('collision_object_2d.cpp:642', 'collision_object_2d.cpp:645', 'collision_object_2d.cpp:646'),
  {
    // collision_object_2d.cpp:650. The 3D twin spells it `input_ray_pickable`.
    input_pickable: v.boolean('input_pickable'),
  },
);

validatorRegistry.registerAll(
  'CollisionObject3D',
  shared('collision_object_3d.cpp:503', 'collision_object_3d.cpp:506', 'collision_object_3d.cpp:507'),
  {
    // collision_object_3d.cpp:511-512. `input_capture_on_drag` is 3D-only.
    input_ray_pickable: v.boolean('input_ray_pickable'),
    input_capture_on_drag: v.boolean('input_capture_on_drag'),
  },
);
