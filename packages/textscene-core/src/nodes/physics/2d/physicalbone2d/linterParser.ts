/**
 * PhysicalBone2D strict validators for linting.
 *
 * Declare only PhysicalBone2D's OWN members — the ones doc/classes/PhysicalBone2D.xml
 * lists without an `overrides=` attribute. Everything from RigidBody2D up
 * (mass, gravity_scale, damping, the CollisionObject2D tier, Node2D, CanvasItem)
 * is registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * doc/classes/PhysicalBone2D.xml declares 5 members, none carrying `overrides=`,
 * and physical_bone_2d.cpp's ADD_PROPERTY list (bind_methods) matches it exactly —
 * every one has a non-empty setter, so all 5 are serialised and validated here.
 */

import '../rigidbody2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('PhysicalBone2D', {
  // scene/2d/physics/physical_bone_2d.cpp:282 — PROPERTY_HINT_NODE_PATH_VALID_TYPES "Bone2D".
  bone2d_nodepath: v.nodePath('bone2d_nodepath'),
  // scene/2d/physics/physical_bone_2d.cpp:283 — PROPERTY_HINT_RANGE "-1, 1000, 1".
  // The hint's -1 is the in-memory default before any property assignment
  // (physical_bone_2d.h:47), never a value the setter accepts: set_bone2d_index
  // (:228-229) is `ERR_FAIL_COND_MSG(p_bone_idx < 0, ...)`, so the real floor
  // is 0, and it errors. There is no `,or_greater` suffix on the hint, but the
  // 1000 ceiling is never checked at scene-load time: the only index check
  // (:237, ERR_FAIL_INDEX_MSG against parent_skeleton->get_bone_count()) is
  // gated on is_inside_tree(), which a freshly-deserialized property assignment
  // never satisfies (packed_scene.cpp sets properties before adding the node to
  // the tree). So the ceiling is only hinted.
  bone2d_index: v.strictInt('bone2d_index', {
    min: 0,
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
