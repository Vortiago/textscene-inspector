/**
 * PhysicalBone2D strict validators: the 5 members doc/classes/PhysicalBone2D.xml lists without
 * `overrides=`, which match physical_bone_2d.cpp's ADD_PROPERTY list. The NODE_BASE_TYPES
 * base-walk delivers everything from RigidBody2D up, and a re-declared key shadows it.
 */

import '../rigidbody2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('PhysicalBone2D', {
  // scene/2d/physics/physical_bone_2d.cpp:282: PROPERTY_HINT_NODE_PATH_VALID_TYPES "Bone2D".
  bone2d_nodepath: v.nodePath('bone2d_nodepath'),
  // scene/2d/physics/physical_bone_2d.cpp:283: PROPERTY_HINT_RANGE "-1, 1000, 1". The -1 is the
  // in-memory default (physical_bone_2d.h:47), and set_bone2d_index (:228-229) refuses
  // `p_bone_idx < 0`, so the floor is 0 and errors.
  bone2d_index: v.strictInt('bone2d_index', {
    min: 0,
    // Only hinted: the bone-count check (:237) needs is_inside_tree(), and properties load
    // before parenting (packed_scene.cpp:492 sets, :541 parents).
    max: 1000,
    enforced: { min: 'physical_bone_2d.cpp:229' },
    hinted: { max: 'physical_bone_2d.cpp:283' },
  }),
  // scene/2d/physics/physical_bone_2d.cpp:284.
  auto_configure_joint: v.boolean('auto_configure_joint'),
  // scene/2d/physics/physical_bone_2d.cpp:285.
  simulate_physics: v.boolean('simulate_physics'),
  // scene/2d/physics/physical_bone_2d.cpp:286.
  follow_bone_when_simulating: v.boolean('follow_bone_when_simulating'),
});
