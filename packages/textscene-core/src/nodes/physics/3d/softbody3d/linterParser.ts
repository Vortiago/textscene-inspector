/**
 * SoftBody3D strict validators for linting.
 *
 * Declare only SoftBody3D's OWN members: the ones doc/classes/SoftBody3D.xml
 * lists without an `overrides=` attribute. Everything from MeshInstance3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * SoftBody3D is not a CollisionObject3D, so `collision_layer`/`collision_mask`
 * are its own members here (soft_body_3d.cpp ADD_PROPERTY, not inherited from
 * a CollisionObject3D tier) rather than arriving through a shared base.
 */

import '../../../3d/meshinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../../linter/validators/index.js';

/** soft_body_3d.cpp:395: PROPERTY_HINT_ENUM "Remove,KeepActive"; soft_body_3d.cpp:397-398 BIND_ENUM_CONSTANT x2. */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'KEEP_ACTIVE' };

validatorRegistry.registerAll('SoftBody3D', {
  // soft_body_3d.cpp:381: PROPERTY_HINT_LAYERS_3D_PHYSICS. SoftBody3D is not a
  // CollisionObject3D, so this is its own 32-bit mask, not an inherited one.
  collision_layer: layerBitmask('collision_layer', { hinted: 'soft_body_3d.cpp:381' }),
  // soft_body_3d.cpp:382: PROPERTY_HINT_LAYERS_3D_PHYSICS, own member (see above).
  collision_mask: layerBitmask('collision_mask', { hinted: 'soft_body_3d.cpp:382' }),
  // soft_body_3d.cpp:390: PROPERTY_HINT_RANGE "0,1,0.01,or_greater" (or_greater
  // makes the 1 a soft editor extent). set_damping_coefficient passes straight
  // to the physics server with no guard, so out-of-range warns.
  damping_coefficient: v.float('damping_coefficient', {
    min: 0,
    hinted: 'soft_body_3d.cpp:390',
  }),
  // soft_body_3d.cpp:395: own enum (SoftBody3D::DisableMode), distinct from
  // CollisionObject3D::DisableMode's 0-2 range; this one only has 2 constants.
  // set_disable_mode is a bare assignment (plus an early-return-if-unchanged
  // guard), so out-of-range warns.
  disable_mode: v.enumInt('disable_mode', 0, 1, DISABLE_MODE, {
    hinted: 'soft_body_3d.cpp:395',
  }),
  // soft_body_3d.cpp:391: PROPERTY_HINT_RANGE "0,1,0.01", no or_greater/or_less.
  // set_drag_coefficient passes straight to the physics server with no guard,
  // so out-of-range warns.
  drag_coefficient: v.float('drag_coefficient', {
    min: 0,
    max: 1,
    hinted: 'soft_body_3d.cpp:391',
  }),
  // soft_body_3d.cpp:387: PROPERTY_HINT_RANGE "0,1,0.01", no or_greater/or_less;
  // SoftBody3D.xml also states "between 0.0 and 1.0 (inclusive)".
  // set_linear_stiffness passes straight to the physics server with no guard,
  // so out-of-range warns.
  linear_stiffness: v.float('linear_stiffness', {
    min: 0,
    max: 1,
    hinted: 'soft_body_3d.cpp:387',
  }),
  // soft_body_3d.cpp:384: PROPERTY_HINT_NODE_PATH_VALID_TYPES "CollisionObject3D".
  // Format only: confirming the path actually resolves to a CollisionObject3D
  // would need to know an instanced sub-scene's internal node types, which this
  // linter cannot see.
  parent_collision_ignore: v.nodePath('parent_collision_ignore'),
  // soft_body_3d.cpp:389: plain PropertyInfo(Variant::FLOAT, ...), no
  // PROPERTY_HINT_RANGE at all, so no bound to enforce.
  pressure_coefficient: v.float('pressure_coefficient'),
  // soft_body_3d.cpp:393: plain PropertyInfo(Variant::BOOL, "ray_pickable").
  ray_pickable: v.boolean('ray_pickable'),
  // soft_body_3d.cpp:388: PROPERTY_HINT_RANGE "-1,1,0.01,or_less,or_greater".
  // Both or_less and or_greater are present, so neither -1 nor 1 is enforced.
  shrinking_factor: v.float('shrinking_factor'),
  // soft_body_3d.cpp:385: PROPERTY_HINT_RANGE "1,100,1", no or_greater/or_less.
  // set_simulation_precision passes straight to the physics server with no
  // guard, so out-of-range warns.
  simulation_precision: v.int('simulation_precision', {
    min: 1,
    max: 100,
    hinted: 'soft_body_3d.cpp:385',
  }),
  // soft_body_3d.cpp:386: PROPERTY_HINT_RANGE "0,1000,0.001,or_greater,exp,suffix:kg"
  // (or_greater makes 1000 a soft editor extent). set_total_mass passes
  // straight to the physics server with no guard, so out-of-range warns.
  total_mass: v.float('total_mass', { min: 0, hinted: 'soft_body_3d.cpp:386' }),
});
