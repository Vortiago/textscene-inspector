/**
 * SoftBody3D strict validators. Declare only its own members, the ones
 * doc/classes/SoftBody3D.xml lists without `overrides=`: the NODE_BASE_TYPES
 * base-walk delivers MeshInstance3D's, and a re-declared key shadows it and
 * duplicates the rule.
 */

import '../../../3d/meshinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, layerBitmask, propertyError, v } from '../../../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';
import { packedArrayLiteral } from '../../../../godot/index.js';

/** soft_body_3d.cpp:395: PROPERTY_HINT_ENUM "Remove,KeepActive"; soft_body_3d.cpp:397-398 BIND_ENUM_CONSTANT x2. */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'KEEP_ACTIVE' };

/**
 * `pinned_points` and `attachments/<i>/*` reach a `.tscn` through a hand-rolled
 * `_set`/`_get`/`_get_property_list` override (soft_body_3d.cpp:129-184), with no
 * `ADD_PROPERTY` and no XML `<member>` (propertyListRouteCoverage.test.ts).
 */
const PINNED_POINTS_FORMS: readonly RegExp[] = [
  /^\s*\[([\s\S]*)\]\s*$/,
  packedArrayLiteral('PackedInt32Array'),
];

/**
 * `_get` (:150-161) builds an untyped `Array`, so Godot writes a bare `[…]`, though
 * soft_body_3d.cpp:176 declares PACKED_INT32_ARRAY. `PackedInt32Array(…)` loads too
 * (variant.cpp:2135-2141). The setter (:186-219) clamps no index, so only the
 * format is checked.
 */
const pinnedPointsValidator: PropertyValidator = accepts((key, value, line) => {
  let body: string | undefined;
  for (const form of PINNED_POINTS_FORMS) {
    const match = form.exec(value);
    if (match) {
      body = match[1]!.trim();
      break;
    }
  }
  if (body === undefined) {
    return propertyError(
      key,
      line,
      `Property 'pinned_points' must be an int array like [0, 3, 7] or PackedInt32Array(0, 3, 7), got: "${value}"`,
      'INVALID_PINNED_POINTS_FORMAT'
    );
  }
  if (body === '') return null;
  const bad = badIntElement('pinned_points', key, line, body, {
      format: 'INVALID_PINNED_POINTS_FORMAT',
      value: 'INVALID_PINNED_POINTS_VALUE',
  });
  return bad.error ?? bad.truncated;
}, 'int array ([…] or PackedInt32Array(…))');
// An INT slot, not format-only: an index no int32 holds reads and is altered.
markIntSlot(pinnedPointsValidator);

/**
 * `attachments/<i>/*` leaves (soft_body_3d.cpp:178-183): `point_index`
 * (INT), `spatial_attachment_path` (NODE_PATH), `offset` (VECTOR3), all
 * pushed with no usage argument (storage-bearing).
 */
const ATTACHMENT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // Format-only, not read-only like ChainIK3D's `joints/<j>/bone`: the setter
  // (:221-243) drops the write (:238-239) and the getter (:245-262) mirrors
  // `pinned_points[i]`, but the key has no usage argument (:180), so it defaults
  // to STORAGE and Godot's own exporter emits it on every pinned point.
  point_index: v.int('point_index'),
  // soft_body_3d.cpp:226-234: assigns through pin_point(), no format check beyond
  // the NodePath shape itself.
  spatial_attachment_path: v.nodePath('spatial_attachment_path'),
  // soft_body_3d.cpp:235-237: bare assignment.
  offset: v.vector3('offset'),
};

const attachmentsValidator = indexedFamilyValidator({
  prefix: 'attachments/',
  leaves: ATTACHMENT_LEAVES,
  unknownCode: 'INVALID_ATTACHMENT_KEY',
  describes: 'attachment',
  // soft_body_3d.cpp:137: a bare `to_int()` with no is_valid_int gate. No
  // negativeIndex: the setter's only guard, `pinned_points.size() <= p_item`
  // (:222-224), does not catch a negative index, so no engine refusal exists.
  indexParse: 'to_int',
});

validatorRegistry.registerAll('SoftBody3D', {
  // soft_body_3d.cpp:381: PROPERTY_HINT_LAYERS_3D_PHYSICS. SoftBody3D is not a
  // CollisionObject3D, so the layer and the mask are its own soft_body_3d.cpp members.
  collision_layer: layerBitmask('collision_layer', { hinted: 'soft_body_3d.cpp:381', width: 'uint32' /* soft_body_3d.h:140 */ }),
  // soft_body_3d.cpp:382: PROPERTY_HINT_LAYERS_3D_PHYSICS.
  collision_mask: layerBitmask('collision_mask', { hinted: 'soft_body_3d.cpp:382', width: 'uint32' /* soft_body_3d.h:137 */ }),
  // soft_body_3d.cpp:390: PROPERTY_HINT_RANGE "0,1,0.01,or_greater" (or_greater
  // makes the 1 a soft editor extent). set_damping_coefficient passes straight
  // to the physics server with no guard, so out-of-range warns.
  damping_coefficient: v.float('damping_coefficient', {
    min: 0,
    hinted: 'soft_body_3d.cpp:390',
  }),
  // soft_body_3d.cpp:395: own enum (SoftBody3D::DisableMode), distinct from
  // CollisionObject3D::DisableMode's 0-2 range. This one only has 2 constants.
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
  // soft_body_3d.cpp:386: PROPERTY_HINT_RANGE "0,1000,0.001,or_greater,exp,suffix:kg".
  // The node setter (:643-645) forwards unchecked. The guard is in the default
  // server (register_server_types.cpp:342): godot_soft_body_3d.cpp:905
  // `ERR_FAIL_COND(p_val < 0.0)`.
  total_mass: v.float('total_mass', {
    min: 0,
    enforcedMin: { at: 0 },
    enforced: { min: 'godot_soft_body_3d.cpp:905' },
  }),

  // soft_body_3d.cpp:176 (_get_property_list) / :150-161 (_get) / :186-219
  // (_set): see pinnedPointsValidator.
  pinned_points: pinnedPointsValidator,
  // soft_body_3d.cpp:178-183 (_get_property_list): see attachmentsValidator.
  'attachments/*': attachmentsValidator,
});
