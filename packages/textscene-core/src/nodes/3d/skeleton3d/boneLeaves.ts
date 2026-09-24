/**
 * `bones/<i>/<leaf>`: every leaf `Skeleton3D::_set` has an arm for, with the check its setter
 * justifies. The keys are the whitelist: `_set` dispatches on `what = path.get_slicec('/', 2)`
 * (skeleton_3d.cpp:83) and closes `} else { return false; }` (:135), so a leaf absent here is a
 * dropped write.
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
 * `name` reaches `add_bone` (skeleton_3d.cpp:86), which refuses an empty name or one holding ':' or
 * '/' (`ERR_FAIL_COND_V_MSG`, :605) and never adds the bone. Measured on the decoded text, after
 * the tokenizer resolves `\uXXXX`. No format check: the `const String &` parameter makes an
 * unquoted `5` the name `5`. `set_bone_name` (:632) is never reached.
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

// Format checks key off the `Variant::` type `_get_property_list` declares (:195-201). `bone_meta`,
// `pose` and `bound_children` appear in no property list, and no setter of theirs refuses a value,
// so they carry no check.
export const BONE_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  name: boneName,

  // :196, Variant::INT. set_bone_parent refuses anything below -1 (`ERR_FAIL_COND(p_parent != -1 &&
  // (p_parent < 0))`, :721), the floor the hint also states. The ceiling is the live bone count,
  // which no per-property validator sees. The dispatcher checks the `p_bone == p_parent` refusal
  // (:722), which needs the index.
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
