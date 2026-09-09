/**
 * `settings/<i>/joints/<j>/<leaf>` — the per-joint half of the hand-rolled
 * property family.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { ROTATION_AXIS } from '../skeletonmodifier3d/linterParser.js';
import { nonZeroVector3 } from './nonZeroVector3.js';

/**
 * `settings/<i>/joints/<j>/<leaf>`, pushed at
 * spring_bone_simulator_3d.cpp:319-327.
 *
 * ## `bone` and `bone_name` are written by Godot and refused on load, and that
 * is not a diagnostic
 *
 * Both are declared WITHOUT `PROPERTY_USAGE_STORAGE` (:319-320), and
 * `_validate_dynamic_prop` then XORs that flag over every `joints/` key when
 * `individual_config` is false (:382), which ADDS storage to exactly these two
 * while removing it from the six tunables beside them. So a scene Godot saves in
 * the default shared mode carries `settings/<i>/joints/<j>/bone` and
 * `bone_name`, and `_set`'s joints branch has no case for either, so both fall
 * to `return false` (:138-139) and the write is dropped.
 *
 * Dropping it loses nothing: `_update_joints` (:1561) rebuilds the joint list
 * from `root_bone`/`end_bone` and re-derives the identical values. Reporting it
 * would fire on every Godot-authored SpringBoneSimulator3D in the default mode,
 * so both stay format checks. (ChainIK3D's slice makes this an error for the
 * same-looking keys; there the usage flags really do keep them out of the file,
 * because that class has no XOR.)
 */
export const JOINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  bone_name: v.quotedString('bone_name'),
  bone: v.strictInt('bone'),

  // :321, PROPERTY_HINT_ENUM over get_hint_rotation_axis().
  // set_joint_rotation_axis (:1001) assigns the static_cast: warning.
  rotation_axis: v.enumInt('rotation_axis', 0, 4, ROTATION_AXIS, {
    hinted: 'spring_bone_simulator_3d.cpp:321',
  }),

  // :322, Variant::VECTOR3 with no hint.
  rotation_axis_vector: v.vector3('rotation_axis_vector'),

  // :323, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". set_joint_radius
  // (:912) assigns straight through once its individual-config gate passes.
  radius: v.float('radius', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:323' }),

  // :324, PROPERTY_HINT_RANGE "0,4,0.01,or_greater". set_joint_stiffness (:932)
  // assigns straight through.
  stiffness: v.float('stiffness', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:324' }),

  // :325, PROPERTY_HINT_RANGE "0,1,0.01,or_greater". set_joint_drag (:949)
  // assigns straight through.
  drag: v.float('drag', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:325' }),

  // :326, "0,1,0.01,or_greater,or_less,suffix:m/s". Both ends open: no bound.
  gravity: v.float('gravity'),

  // :327, and the joint-level twin of the setting's gravity/direction.
  gravity_direction: nonZeroVector3(
    'gravity_direction',
    'spring_bone_simulator_3d.cpp:985',
  ),
};
