/**
 * `bones/<i>/<leaf>` — every leaf `Skeleton3D::_set` has an arm for, with the
 * check that arm's setter justifies.
 *
 * The KEYS are the whitelist: `_set` dispatches on
 * `what = path.get_slicec('/', 2)` (skeleton_3d.cpp:83) and closes
 * `} else { return false; }` (:135), so a leaf absent here is a dropped write.
 *
 * Format checks key off the `Variant::` type `_get_property_list` declares
 * (:195-201). `bone_meta`, `pose` and `bound_children` appear in no property
 * list and no setter of theirs refuses a value, so they carry no check.
 */

import { addBoneRefusal, boneNameText } from './boneNameOrder.js';
import {
  VECTOR3_REGEX,
  makeFloatTupleRegex,
  propertyError,
  shape,
  v,
} from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific), matching
// v.quaternion and the renderer.
const QUATERNION_REGEX = makeFloatTupleRegex('Quaternion', 4);

/**
 * `name` reaches `add_bone` (skeleton_3d.cpp:86), which opens
 * `ERR_FAIL_COND_V_MSG(p_name.is_empty() || p_name.contains_char(':') ||
 * p_name.contains_char('/'), -1, …)` (:605): the bone is never added.
 *
 * Measured on the DECODED text, because the tokenizer resolves `\uXXXX` before
 * the setter sees it. No format check sits in front of it: the parameter is
 * a `const String &`, so `Variant::operator String()` stringifies whatever the
 * file carries and an unquoted `5` names a bone `5` rather than being refused.
 *
 * `set_bone_name` (:632) refuses a duplicate too, but `_set` never reaches it —
 * `name` has no arm below :90, so `add_bone` is the only setter this leaf hits.
 */
const boneName: PropertyValidator = (key, value, line) => {
  const refused = addBoneRefusal(boneNameText(value));
  if (refused === null) return null;
  return propertyError(
    key,
    line,
    refused === ''
      ? `Property '${key}' must be a non-empty bone name; Godot's add_bone refuses an empty one and never adds the bone.`
      : `Property '${key}' carries "${refused}" in the bone name; Godot's add_bone refuses one containing ":" or "/" and never adds the bone.`,
    'INVALID_BONE_NAME'
  );
};
boneName.accepts = 'non-empty bone name without ":" or "/"';
boneName.grounding = { kind: 'enforced', cite: 'skeleton_3d.cpp:605' };

/** A leaf whose value no setter of its own refuses. */
const unchecked = (accepts: string): PropertyValidator => shape(() => null, accepts);

export const BONE_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  name: boneName,

  // :196, Variant::INT. set_bone_parent refuses anything below -1 outright
  // (`ERR_FAIL_COND(p_parent != -1 && (p_parent < 0))`, :721); the hint on the
  // same line states that identical floor, so it grounds nothing further. The
  // ceiling is the live bone count, which no per-property validator can see.
  // The `p_bone == p_parent` refusal beside it (:722) needs the key's index and
  // lives in the dispatcher.
  parent: v.strictInt('parent', { min: -1, enforced: 'skeleton_3d.cpp:721' }),

  // :197, Variant::TRANSFORM3D. set_bone_rest (:774) guards the bone index and
  // nothing else. PROPERTY_USAGE_READ_ONLY on the same line greys the inspector
  // field; the `rest` arm at :94 still loads the value from a file.
  rest: v.transform3d('rest'),

  // :198, Variant::BOOL. set_bone_enabled (:798) guards the bone index only.
  enabled: v.boolean('enabled'),

  // :199 and :201, Variant::VECTOR3. set_bone_pose_position (:99) and
  // set_bone_pose_scale (:103) guard the bone index only.
  position: shape(
    (key, value, line) =>
      VECTOR3_REGEX.test(value)
        ? null
        : propertyError(key, line, `Property '${key}' must be Vector3 format like Vector3(0, 0, 0), got: "${value}"`, 'INVALID_BONE_VECTOR3_FORMAT'),
    'Vector3(x, y, z)'
  ),
  scale: shape(
    (key, value, line) =>
      VECTOR3_REGEX.test(value)
        ? null
        : propertyError(key, line, `Property '${key}' must be Vector3 format like Vector3(0, 0, 0), got: "${value}"`, 'INVALID_BONE_VECTOR3_FORMAT'),
    'Vector3(x, y, z)'
  ),

  // :200, Variant::QUATERNION. set_bone_pose_rotation (:101) guards the index.
  rotation: shape(
    (key, value, line) =>
      QUATERNION_REGEX.test(value)
        ? null
        : propertyError(key, line, `Property '${key}' must be Quaternion format like Quaternion(0, 0, 0, 1), got: "${value}"`, 'INVALID_BONE_QUATERNION_FORMAT'),
    'Quaternion(x, y, z, w)'
  ),

  // :204 writes `bone_meta/<key>`; the key is slice 3, read at :105, and
  // set_bone_meta (:686) guards the bone index only. A NIL value erases the
  // entry (:689-694) rather than being refused, so every value is legal.
  bone_meta: unchecked('any value; NIL erases the entry'),

  // :107, behind `#ifndef DISABLE_DEPRECATED` (:106). `pose` is recomposed
  // against the rest and `bound_children`'s value is never read at all, so
  // neither has a setter that could refuse one.
  pose: unchecked('3.x pose transform'),
  bound_children: unchecked('3.x bound-children list, ignored'),
};
