/**
 * Skeleton3D strict validators. `bones/<idx>/<sub>` keeps a bespoke dispatcher, because the index,
 * the leaf whitelist and the self-parent refusal read the key, which `v`'s per-property combinators
 * never see. The per-leaf checks behind it are ordinary combinators in `boneLeaves.ts`.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves an
// inherited key only when the ancestor is imported too.
import '../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { keyShapeError, propertyError, v } from '../../../linter/validators/index.js';
import { firstSegment, indexedKeyRegex, parseGodotInt, stringToInt } from '../../../godot/index.js';
import { writtenIndex } from '../../../linter/reportedIndices.js';
import { BONE_LEAVES } from './boneLeaves.js';
import { UNREACHABLE_BONE_SLOT } from './boneNameOrder.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const MODIFIER_CALLBACK_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };

/**
 * `bones/<idx>/<sub>`: the index is a bare `path.get_slicec('/', 1).to_int()` with no validity gate
 * (skeleton_3d.cpp:82), so {@link stringToInt} decides the number: `bones/x/position` names bone 0,
 * and Godot applies it.
 */
const BONE_KEY_RE = indexedKeyRegex('^bones/(#)/(.+)$', 'to_int');

/**
 * `bones/<idx>/<sub>` dispatcher. The malformed-key and Vector3/Quaternion
 * shape branches reject only format; the out-of-range index and the unknown
 * leaf are both writes `_set` refuses, so the whole function is tagged
 * `bounded` + `grounding` rather than `formatOnly`.
 */
const bonesValidator: PropertyValidator = (key, value, line) => {
  const match = BONE_KEY_RE.exec(key);
  if (!match) {
    // `keyVerdict`: the key names no slot, so the nil rewrite has no zero
    // value to claim. Spelled here rather than through `keyShapeError` because
    // column 1 anchors the whole key, not past it.
    return {
      severity: 'error',
      message: `Invalid bone property key format: "${key}". Expected: bones/<number>/<property>`,
      line,
      column: 1,
      code: 'INVALID_BONE_PROPERTY_KEY',
      keyVerdict: true,
    };
  }

  // The index lands in a `uint32_t which` (:82), so `-1` is stored as 4294967295 and
  // `4294967296` as 0.
  const which = stringToInt(match[1]!, 'uint32');
  if (which >= UNREACHABLE_BONE_SLOT) {
    return {
      severity: 'error',
      message: `Bone index ${writtenIndex(match[1]!, which)} is past any bone count a file reaches, so Godot drops the write.`,
      line,
      column: 1,
      code: 'INVALID_BONE_INDEX',
      keyVerdict: true,
    };
  }

  // Slice 2 alone decides the arm: `bones/0/bone_meta/<key>` reaches the `bone_meta` arm with the
  // key read separately at :105, and a trailing slice on any other leaf is ignored, so the same
  // setter gets the same value.
  const what = firstSegment(match[2]!);

  // skeleton_3d.cpp:135: the chain closes `} else { return false; }`, so a leaf
  // with no arm is a write Godot silently drops.
  if (!Object.prototype.hasOwnProperty.call(BONE_LEAVES, what)) {
    return keyShapeError(
      key,
      line,
      `Unknown bone property: "${key}". Skeleton3D has no "${what}" bone property, so Godot drops the write.`,
      'UNKNOWN_BONE_PROPERTY'
    );
  }

  const leaf = BONE_LEAVES[what]!;
  const verdict = leaf(key, value, line);
  if (verdict) return verdict;

  // skeleton_3d.cpp:722: `ERR_FAIL_COND(p_bone == p_parent)`. Both halves come off this one key
  // (`which` from the path, the parent from the value), so the dispatcher can answer it. Compared
  // as numbers, because `bones/03/parent = 3` names bone 3 twice.
  if (what === 'parent') {
    const parent = parseGodotInt(value);
    if (parent !== null && parent === which) {
      return propertyError(
        key,
        line,
        `Bone ${writtenIndex(match[1]!, which)} cannot be its own parent; Godot refuses the write and the bone keeps its previous parent.`,
        'SELF_PARENTED_BONE'
      );
    }
  }

  return null;
};

validatorRegistry.registerAll('Skeleton3D', {
  // skeleton_3d.cpp:586-588: `if (p_motion_scale <= 0) { motion_scale = 1; ERR_FAIL_MSG(...); }`,
  // an alteration, not a refusal. The hint (:1293, "0.001,10,0.001,or_greater") floors higher and
  // opens the ceiling, so (0, 0.001) is stored as authored and only warns.
  motion_scale: v.positiveFloat(
    'motion_scale',
    "Property 'motion_scale' must be greater than 0. Godot substitutes 1.0 for anything at or below it.",
    {
      min: 0.001,
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

// Shown in the generated `## Linting` table of this node's sheet. Spelled
// without a `/`: `godotLiteralGrammar.guard.test.ts` reads a slash-delimited run
// carrying a composite name as a hand-rolled literal grammar.
bonesValidator.accepts =
  'leaf `name` (non-empty, no colon or slash), `parent` (int from -1, never the bone itself), `rest` (Transform3D), `enabled` (bool), `position` and `scale` (Vector3), `rotation` (Quaternion), `bone_meta`, or the 3.x `pose` and `bound_children`';
// Tagged by hand, not built through `v`, so `boundGrounding.test.ts` sees the out-of-range bound
// too.
bonesValidator.grounding = { kind: 'enforced', cite: 'skeleton_3d.cpp:90' };
// The dispatcher's tag says nothing about the bounds behind it, so the sweep
// has to recurse past it (`indexedFamilyValidator` exposes its leaves for the
// same reason).
bonesValidator.leaves = Object.values(BONE_LEAVES);
