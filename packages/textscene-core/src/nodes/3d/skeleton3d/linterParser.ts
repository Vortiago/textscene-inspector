/**
 * Skeleton3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 *
 * Bone properties (`bones/<idx>/<sub>`) keep a bespoke validator because the
 * sub-property name drives format choice (Vector3 for position/scale,
 * Quaternion for rotation), which `v`'s per-property combinators have no way
 * to key on.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import {
  v,
  VECTOR3_REGEX,
  makeFloatTupleRegex,
} from '../../../linter/validators/index.js';
import { propertyError } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const MODIFIER_CALLBACK_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };

// Shared canonical float grammar (accepts .5 / 5. / +5 / scientific), matching
// v.quaternion and the renderer.
const QUATERNION_REGEX = makeFloatTupleRegex('Quaternion', 4);

/**
 * `bones/<idx>/<sub>` dispatcher. The malformed-key and Vector3/Quaternion
 * shape branches reject only format; the negative-index branch is a real
 * bound (see the citation below), so the whole function is tagged `bounded`
 * + `grounding` rather than `formatOnly`.
 */
const bonesValidator: PropertyValidator = (key, value, line) => {
  const match = key.match(/^bones\/(\d+)\/(.+)$/);
  if (!match || !match[1] || !match[2]) {
    const negativeMatch = key.match(/^bones\/(-\d+)\//);
    if (negativeMatch) {
      // skeleton_3d.cpp:82, `path.get_slicec('/', 1).to_int()` assigned into a
      // `uint32_t which`: a negative index wraps to a huge value, and :90
      // `ERR_FAIL_UNSIGNED_INDEX_V(which, bones.size(), false)` then refuses it.
      return {
        severity: 'error',
        message: `Bone index must be non-negative, got: ${negativeMatch[1]}`,
        line,
        column: 1,
        code: 'INVALID_BONE_INDEX',
      };
    }
    return {
      severity: 'error',
      message: `Invalid bone property key format: "${key}". Expected: bones/<number>/<property>`,
      line,
      column: 1,
      code: 'INVALID_BONE_PROPERTY_KEY',
    };
  }

  const propertyName = match[2];

  if (propertyName === 'position' || propertyName === 'scale') {
    if (!VECTOR3_REGEX.test(value)) {
      return propertyError(key, line, `Property '${key}' must be Vector3 format like Vector3(0, 0, 0), got: "${value}"`, 'INVALID_BONE_VECTOR3_FORMAT');
    }
  } else if (propertyName === 'rotation') {
    if (!QUATERNION_REGEX.test(value)) {
      return propertyError(key, line, `Property '${key}' must be Quaternion format like Quaternion(0, 0, 0, 1), got: "${value}"`, 'INVALID_BONE_QUATERNION_FORMAT');
    }
  }

  return null;
};

validatorRegistry.registerAll('Skeleton3D', {
  // skeleton_3d.cpp:586-588: `if (p_motion_scale <= 0) { motion_scale = 1;
  // ERR_FAIL_MSG(...); }` — an alteration, not a refusal. The hint (:1293,
  // "0.001,10,0.001,or_greater") floors higher and opens the ceiling, so
  // (0, 0.001) is stored as authored and only warns.
  motion_scale: v.positiveFloat(
    'motion_scale',
    "Property 'motion_scale' must be greater than 0. Godot substitutes 1.0 for anything at or below it.",
    {
      hintedMin: 0.001,
      enforced: 'skeleton_3d.cpp:586',
      hinted: 'skeleton_3d.cpp:1293',
    }
  ),
  // skeleton_3d.cpp:1294, plain BOOL ADD_PROPERTY, no hint. set_show_rest_only
  // (:814-817) is a bare assignment (plus a signal emit, not a rejection).
  show_rest_only: v.boolean('show_rest_only'),
  // skeleton_3d.cpp:1326, plain BOOL ADD_PROPERTY, no hint.
  // set_animate_physical_bones (:1369-1376) is a bare assignment.
  animate_physical_bones: v.boolean('animate_physical_bones'),
  // skeleton_3d.cpp:435-441 is a bare assignment (only an equal-check early
  // return); no engine-side range check on the raw int.
  modifier_callback_mode_process: v.enumInt(
    'modifier_callback_mode_process',
    0,
    2,
    MODIFIER_CALLBACK_MODE,
    { hinted: 'skeleton_3d.cpp:1297' }
  ),
  'bones/*': bonesValidator,
});

// Shown in the generated `## Linting` table of this node's sheet.
bonesValidator.accepts = 'bone pose component (float, Vector3 or Quaternion)';
// Tagged by hand (not built through `v`) so `boundGrounding.test.ts`'s sweep
// sees the negative-index bound too.
bonesValidator.grounding = { kind: 'enforced', cite: 'skeleton_3d.cpp:90' };
