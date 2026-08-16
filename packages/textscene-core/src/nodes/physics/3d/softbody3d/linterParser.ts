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
 *
 * `pinned_points` and `attachments/<i>/*` are a THIRD route on top of those
 * two: a hand-rolled `_set`/`_get`/`_get_property_list` override
 * (soft_body_3d.cpp:129-184), zero `ADD_PROPERTY`, zero XML `<member>`. See
 * propertyListRouteCoverage.test.ts.
 */

import '../../../3d/meshinstance3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, layerBitmask, propertyError, v } from '../../../../linter/validators/index.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { badIntElement } from '../../../../linter/validators/v/packedArrays.js';
import { markIntSlot } from '../../../../linter/validators/intSlot.js';

/** soft_body_3d.cpp:395: PROPERTY_HINT_ENUM "Remove,KeepActive"; soft_body_3d.cpp:397-398 BIND_ENUM_CONSTANT x2. */
const DISABLE_MODE = { 0: 'REMOVE', 1: 'KEEP_ACTIVE' };

const PINNED_POINTS_FORMS: readonly RegExp[] = [
  /^\s*\[([\s\S]*)\]\s*$/,
  /^\s*PackedInt32Array\s*\(([\s\S]*)\)\s*$/,
];

/**
 * `pinned_points`: declared `PropertyInfo(Variant::PACKED_INT32_ARRAY, …)`
 * (soft_body_3d.cpp:176) with no usage argument (PROPERTY_USAGE_DEFAULT,
 * storage-bearing), but `_get`'s "pinned_points" branch (:150-161) builds an
 * untyped `Array` of point indices, not a PackedInt32Array — the GETTER
 * decides the serialised form, so Godot's own writer emits a bare `[…]`
 * literal. `PackedInt32Array(…)` is accepted too: `_set_property_pinned_points_indices`
 * takes `const Array &`, and `Variant::operator Array()` converts a
 * PACKED_INT32_ARRAY source (variant.cpp:2135-2141), so a hand-written one
 * loads fine.
 *
 * `_set_property_pinned_points_indices` (:186-219) has no clamp on the indices
 * themselves — only a format check belongs here.
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
  if (bad !== null) return bad;
  return null;
}, 'int array ([…] or PackedInt32Array(…))');
// An INT slot, not format-only: an index no int32 holds reads and is altered.
markIntSlot(pinnedPointsValidator);

/**
 * `attachments/<i>/*` leaves (soft_body_3d.cpp:178-183): `point_index`
 * (INT), `spatial_attachment_path` (NODE_PATH), `offset` (VECTOR3), all
 * pushed with no usage argument (storage-bearing).
 */
const ATTACHMENT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // Format-only, and deliberately NOT the read-only treatment ChainIK3D's
  // `joints/<j>/bone` gets, though the setter behaves the same way:
  // `_set_property_pinned_points_attachment` (:221-243) has no branch for
  // "point_index" and falls to `return false` (:238-239), so the write is
  // dropped, while `_get_property_pinned_points` (:245-262) reads it back as a
  // mirror of the matching `pinned_points[i]`.
  //
  // The difference is who writes the key. ChainIK3D's is pushed with a usage
  // list carrying no STORAGE bit, so it never reaches a `.tscn` and rejecting
  // it can only ever catch a hand-edit. This one is pushed with NO usage
  // argument (:180), so it defaults to STORAGE and Godot's own exporter emits
  // it — `scenes/demos/3d/soft_body_physics/test.tscn` carries four of them,
  // written by Godot. Rejecting it would reject the engine's own output on
  // every SoftBody3D with a pinned point.
  point_index: v.int('point_index'),
  // soft_body_3d.cpp:226-234: assigns via pin_point(), no format check beyond
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
  // soft_body_3d.cpp:137: `int idx = name.get_slicec('/', 1).to_int();` — a
  // bare to_int with no is_valid_int gate, the same shape BoneConstraint3D's
  // settings/ family uses. No negativeIndex: `_set_property_pinned_points_attachment`'s
  // only guard is `pinned_points.size() <= p_item` (:222-224), which does not
  // catch a negative p_item, so there is no engine refusal to cite.
  indexParse: 'to_int',
});

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

  // soft_body_3d.cpp:176 (_get_property_list) / :150-161 (_get) / :186-219
  // (_set): see pinnedPointsValidator.
  pinned_points: pinnedPointsValidator,
  // soft_body_3d.cpp:178-183 (_get_property_list): see attachmentsValidator.
  'attachments/*': attachmentsValidator,
});
