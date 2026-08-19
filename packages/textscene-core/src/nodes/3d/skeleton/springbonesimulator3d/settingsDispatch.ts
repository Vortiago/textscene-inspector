/**
 * The `settings/*` dispatcher: which of the three levels of the hand-rolled
 * family a key belongs to, and what a negative setting index costs.
 */

import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import { toIntIndex } from '../../../../godot/index.js';
import { JOINT_LEAVES } from './jointLeaves.js';
import { SETTING_LEAVES } from './settingLeaves.js';

/**
 * Why a negative setting index is refused, shared by every level of the family
 * so they all report the same thing.
 */
const negativeSettingIndex = (index: number): string =>
  `Setting index ${index} must be non-negative; SpringBoneSimulator3D::_set fails ` +
  'ERR_FAIL_INDEX_V(which, settings.size(), false) (spring_bone_simulator_3d.cpp:44) ' +
  'before reaching the property, so the write never lands';

/**
 * The depth-3 level, which is exactly the `<prefix><int>/<leaf>` shape the
 * shared dispatcher parses, multi-segment leaves included.
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
 * The two sub-arrays the shared dispatcher cannot reach, because their own path
 * carries a second index.
 *
 * The index halves are `[^/]+` rather than `\d+` on purpose: under `to_int` a
 * non-numeric index still resolves, so `settings/x/joints/y/radius` is a write
 * Godot applies and must route to the same leaf rather than fall through and be
 * reported as an unknown key.
 */
const JOINT_KEY = /^settings\/([^/]+)\/joints\/[^/]+\/(.+)$/;
/** `settings/<i>/collisions/<j>` and `settings/<i>/exclude_collisions/<j>`, :332-338. */
const COLLISION_KEY = /^settings\/([^/]+)\/(?:exclude_)?collisions\/[^/]+$/;

/**
 * The negative-setting-index branch every level shares, or null when the index
 * `to_int` resolves is not negative.
 *
 * The index is read the way `_set` reads it, with a bare
 * `get_slicec('/', 1).to_int()` and no validity gate (:42), so a spelling
 * `is_valid_int` rejects still names a setting: `x` is 0 and the write lands
 * there, while `a-1` is -1 (ustring.cpp:2291-2292) and :44 refuses it. A NaN
 * index — a spelling neither reader can name — fails the comparison and is
 * left alone.
 */
function negativeIndexError(indexText: string, key: string, line: number) {
  const index = toIntIndex(indexText);
  if (index < 0) {
    return propertyError(key, line, negativeSettingIndex(index), 'INVALID_SETTING_INDEX');
  }
  return null;
}

/**
 * Every `SpringBoneCollision3D` path in either list, hinted
 * `PROPERTY_HINT_NODE_PATH_VALID_TYPES` (:333, :338). Both setters (:1092,
 * :1148) reset the slot and then store whatever path they are handed, reporting
 * a non-child only through `ERR_FAIL_EDMSG`, which is editor-only, so the format
 * is all that is checkable here. Whether the list is live at all depends on
 * `enable_all_child_collisions`, and that is linter.ts's.
 */
const collisionPath = v.nodePath('collision_path');

/**
 * `settings/…` on SpringBoneSimulator3D: the joint sub-tree, the two collision
 * lists, then everything flat.
 *
 * Registered under the PLAIN `settings/*` wildcard rather than the glued-index
 * `settings/#/*`: `matchesIndexedKey` routes a single leaf segment only, so a
 * nested key registered under `#/*` would reach this dispatcher never and be
 * silently accepted.
 */
export const settingsValidator: PropertyValidator = accepts((key, value, line) => {
  const joint = JOINT_KEY.exec(key);
  if (joint) {
    const negative = negativeIndexError(joint[1]!, key, line);
    if (negative) return negative;
    const leafName = joint[2]!;
    // The JOINT index is deliberately unchecked: each leaf's ERR_FAIL_INDEX sits
    // in its own setter behind an individual-config gate that returns first
    // (:914, :934, :951, :968, :1003, :1029), so there is no single line to cite
    // and in the shared mode nothing reaches the index check at all.
    if (Object.prototype.hasOwnProperty.call(JOINT_LEAVES, leafName)) {
      return JOINT_LEAVES[leafName]!(key, value, line);
    }
    return propertyError(
      key,
      line,
      `Unknown SpringBoneSimulator3D joint property: "${key}". _set has no case for ` +
        'it and returns false (spring_bone_simulator_3d.cpp:138-139), so the write is dropped',
      'INVALID_SPRING_BONE_JOINT_KEY',
    );
  }

  const collision = COLLISION_KEY.exec(key);
  if (collision) {
    const negative = negativeIndexError(collision[1]!, key, line);
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
