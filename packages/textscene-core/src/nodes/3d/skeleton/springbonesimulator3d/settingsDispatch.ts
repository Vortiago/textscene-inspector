/**
 * The `settings/*` dispatcher: which of the three levels of the hand-rolled
 * family a key belongs to, and what a negative setting index costs.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { accepts, keyShapeError, v } from '../../../../linter/validators/index.js';
import { indexedKeyRegex } from '../../../../godot/index.js';
import { negativeIndexError } from '../../../../linter/reportedIndices.js';
import { JOINT_LEAVES } from './jointLeaves.js';
import { SETTING_LEAVES } from './settingLeaves.js';

/**
 * Why a negative setting index is refused, shared by every level of the family
 * so they all report the same thing.
 */
const negativeSettingIndex = (index: string): string =>
  `Setting index ${index} must be non-negative; SpringBoneSimulator3D::_set fails ` +
  'ERR_FAIL_INDEX_V(which, settings.size(), false) (spring_bone_simulator_3d.cpp:44) ' +
  'before reaching the property, so the write never lands';

/**
 * The depth-3 level, the `<prefix><int>/<leaf>` shape the shared dispatcher parses.
 * SpringBoneSimulator3D has no subclass in 4.6.3, so the leaf set closes: `_set` returns false on
 * an unknown leaf (:151-152). It reads two segments below the index at most, so
 * `settings/0/radius/value/junk` lands on `set_radius` though this reports it.
 */
const settingLeafValidator = indexedFamilyValidator({
  indexParse: 'to_int',
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: 'INVALID_SPRING_BONE_SETTING_KEY',
  describes: 'SpringBoneSimulator3D setting',
  negativeIndex: {
    cite: 'spring_bone_simulator_3d.cpp:44',
    code: 'INVALID_SETTING_INDEX',
    message: negativeSettingIndex,
  },
});

/**
 * The two sub-arrays the shared dispatcher cannot reach, because their path carries a second index.
 * `_set` dispatches on one slice: the joint branch reads `get_slicec('/', 4)` (:121-123), and
 * neither collision branch reads below its index (:143-145, :148-150), so
 * `settings/0/joints/0/radius/extra` reaches `set_joint_radius`.
 */
const JOINT_KEY = indexedKeyRegex('^settings/(#)/joints/#/([^/]+)(?:/.*)?$', 'to_int');
/** `settings/<i>/collisions/<j>` and `settings/<i>/exclude_collisions/<j>`. */
const COLLISION_KEY = indexedKeyRegex(
  '^settings/(#)/(?:exclude_)?collisions/#(?:/.*)?$',
  'to_int'
);

/**
 * The negative-setting-index branch every level shares, or null. `_set` reads the index with a bare
 * `get_slicec('/', 1).to_int()` and no validity gate (:42), so `x` is 0 and lands, and :44 refuses a
 * negative one.
 */
function negativeSettingError(indexText: string, key: string, line: number) {
  return negativeIndexError(indexText, key, line, negativeSettingIndex, 'INVALID_SETTING_INDEX');
}

/**
 * Every `SpringBoneCollision3D` path in either list, hinted `PROPERTY_HINT_NODE_PATH_VALID_TYPES`
 * (:333, :338). Both setters (:1092, :1148) store any path and report a non-child only through the
 * editor-only `ERR_FAIL_EDMSG`, so only the format is checkable. linter.ts decides whether the list
 * is live.
 */
const collisionPath = v.nodePath('collision_path');

/**
 * `settings/…` on SpringBoneSimulator3D: the joint sub-tree, the two collision lists, then
 * everything flat. Registered under the plain `settings/*` wildcard, not `settings/#/*`:
 * `matchesIndexedKey` routes a single leaf segment only, so a nested key would never reach this
 * dispatcher and pass unchecked.
 */
export const settingsValidator: PropertyValidator = accepts((key, value, line) => {
  const joint = JOINT_KEY.exec(key);
  if (joint) {
    const negative = negativeSettingError(joint[1]!, key, line);
    if (negative) return negative;
    const leafName = joint[2]!;
    // The joint index is unchecked on purpose: each leaf's ERR_FAIL_INDEX sits in its own setter
    // behind an individual-config gate that returns first (:914, :934, :951, :968, :1003, :1029),
    // so no single line is citable, and in shared mode nothing reaches the check.
    if (Object.prototype.hasOwnProperty.call(JOINT_LEAVES, leafName)) {
      return JOINT_LEAVES[leafName]!(key, value, line);
    }
    return keyShapeError(
      key,
      line,
      `Unknown SpringBoneSimulator3D joint property: "${key}". _set has no case for ` +
        'it and returns false (spring_bone_simulator_3d.cpp:138-139), so the write is dropped',
      'INVALID_SPRING_BONE_JOINT_KEY',
    );
  }

  const collision = COLLISION_KEY.exec(key);
  if (collision) {
    const negative = negativeSettingError(collision[1]!, key, line);
    if (negative) return negative;
    return collisionPath(key, value, line);
  }

  return settingLeafValidator(key, value, line);
}, 'SpringBoneSimulator3D settings/<i>/ bone chain setup');

// The only value this dispatcher refuses on its own authority is a negative
// setting index and an unrecognised joint leaf, both of which `_set` refuses;
// every magnitude bound lives in the leaves, exposed so `boundGrounding`'s sweep
// recurses past this function.
settingsValidator.grounding = { kind: 'enforced', cite: 'spring_bone_simulator_3d.cpp:44' };
settingsValidator.leaves = [
  settingLeafValidator,
  ...Object.values(JOINT_LEAVES),
  collisionPath,
];
