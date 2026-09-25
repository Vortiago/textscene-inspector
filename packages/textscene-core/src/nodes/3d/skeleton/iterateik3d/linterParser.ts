/**
 * Validators for every IterateIK3D-derived node, under the abstract key 'IterateIK3D', which Godot
 * cannot instantiate. The base-walk delivers them to CCDIK3D, FABRIK3D and JacobianIK3D. Only its own
 * members: those doc/classes/IterateIK3D.xml lists without `overrides=`, checked against ADD_PROPERTY.
 */

// The `settings/*` dispatcher hands every key it does not own to ChainIK3D, and a tier loads only
// when imported. CCDIK3D, FABRIK3D and JacobianIK3D import only this file, so without this line
// ChainIK3D would register only with SplineIK3D loaded, and its bounds would vanish for all three.
import '../chainik3d/linterParser.js';
import { validatorRegistry, type PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { accepts, v } from '../../../../linter/validators/v.js';
import { settingCount } from '../shared/settingCount.js';
import {
  ROTATION_AXIS,
  SECONDARY_DIRECTION,
} from '../skeletonmodifier3d/linterParser.js';
import { indexedKeyRegex } from '../../../../godot/index.js';
import { negativeIndexError } from '../../../../linter/reportedIndices.js';

/**
 * Why a negative setting index is refused, shared by both levels of the family
 * so the two report the same thing.
 */
const negativeSettingIndex = (index: string): string =>
  `Setting index ${index} must be non-negative; IterateIK3D::_set fails the index check (iterate_ik_3d.cpp:39) before reaching the property, so the write never lands`;


/**
 * `settings/<i>/joints/<j>/…`, pushed at iterate_ik_3d.cpp:120-125, keyed by everything after the
 * joint index, so `limitation/right_axis` is one leaf name. Every setter assigns past ERR_FAIL_INDEX
 * on the two indices only (iterate_ik_3d.cpp:216-324), so each PROPERTY_HINT_ENUM warns.
 */
const JOINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  rotation_axis: v.enumInt('rotation_axis', 0, 4, ROTATION_AXIS, {
    hinted: 'iterate_ik_3d.cpp:120',
  }),
  rotation_axis_vector: v.vector3('rotation_axis_vector'),
  limitation: v.resourceReference('limitation'),
  'limitation/right_axis': v.enumInt('right_axis', 0, 7, SECONDARY_DIRECTION, {
    hinted: 'iterate_ik_3d.cpp:123',
  }),
  'limitation/right_axis_vector': v.vector3('right_axis_vector'),
  'limitation/rotation_offset': v.quaternion('rotation_offset'),
};

/** `settings/<i>/<leaf>`, pushed at iterate_ik_3d.cpp:117. */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  target_node: v.nodePath('target_node'),
};

/**
 * The depth-3 `<prefix><int>/<leaf>` level the shared dispatcher parses. It supplies the
 * negative-index branch: `_set` opens with `ERR_FAIL_INDEX_V(which, settings.size(), false)`.
 */
const settingLeafValidator = indexedFamilyValidator({
  // `_set` reads the index with a bare `to_int` and no `is_valid_int` gate (iterate_ik_3d.cpp:37),
  // and `_to_int` skips non-digits (ustring.cpp:2268-2298), so `settings/first/x` lands on setting 0.
  // Dropping such a key is PropertyListHelper's behaviour, not this class's.
  indexParse: 'to_int',
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: 'INVALID_ITERATE_SETTING_KEY',
  describes: 'IterateIK3D setting',
  negativeIndex: {
    cite: 'iterate_ik_3d.cpp:39',
    code: 'INVALID_SETTING_INDEX',
    message: negativeSettingIndex,
  },
});

/**
 * The joint sub-tree, which the shared dispatcher cannot reach: it splits at the first `/` past the
 * prefix (`indexedFamily.ts:214-219`), so `joints/1/rotation_axis` arrives as one leaf name with an
 * index inside. Both indices parse under `to_int`, as `_set` reads each with a bare
 * `get_slicec(...).to_int()` and no gate (:37, :44), so a non-digit spelling still lands.
 */
const JOINT_KEY = indexedKeyRegex('^settings/(#)/joints/#/(.+)$', 'to_int');

/**
 * `settings/…` on IterateIK3D, half of a family: `_get_property_list` pushes its own leaves, then
 * calls `ChainIK3D::get_property_list` (iterate_ik_3d.cpp:129). This wildcard shadows ChainIK3D's, so
 * a leaf this file does not own, such as `settings/0/root_bone_name`, goes back to ChainIK3D, which
 * has the last word. `findValidator` walks upwards only, so the hand-back cannot return here.
 */
const settingsValidator = accepts((key, value, line) => {
  const joint = JOINT_KEY.exec(key);
  if (joint) {
    const leafName = joint[2]!;
    if (Object.prototype.hasOwnProperty.call(JOINT_LEAVES, leafName)) {
      // The joint index is deliberately unchecked: each leaf's ERR_FAIL_INDEX
      // sits in its own setter, so there is no single line to cite, and the
      // setting index below already covers what `_set` refuses uniformly.
      const negative = negativeIndexError(
        joint[1]!,
        key,
        line,
        negativeSettingIndex,
        'INVALID_SETTING_INDEX'
      );
      if (negative) return negative;
      return JOINT_LEAVES[leafName]!(key, value, line);
    }
  } else if (key.endsWith('/target_node')) {
    return settingLeafValidator(key, value, line);
  }

  const inherited = validatorRegistry.findValidator('ChainIK3D', key);
  return inherited ? inherited(key, value, line) : null;
}, 'IterateIK3D setting key, or the ChainIK3D setting key it inherits');

// The only value this dispatcher refuses on its own authority is a negative
// setting index, which `_set` refuses outright. Every magnitude bound lives in
// the leaves, exposed so `boundGrounding`'s sweep recurses past this function.
settingsValidator.grounding = { kind: 'enforced', cite: 'iterate_ik_3d.cpp:39' };
settingsValidator.leaves = [settingLeafValidator, ...Object.values(JOINT_LEAVES)];

validatorRegistry.registerAll('IterateIK3D', {
  // iterate_ik_3d.cpp:394, PROPERTY_HINT_RANGE "0,100,or_greater".
  // `or_greater` opens the max end, so only the floor is checkable, and
  // set_max_iterations (iterate_ik_3d.cpp:169) is a bare assignment, which
  // makes it a warning.
  max_iterations: v.int('max_iterations', { min: 0, hinted: 'iterate_ik_3d.cpp:394' }),

  // iterate_ik_3d.cpp:395, PROPERTY_HINT_RANGE "0,1,0.001,or_greater". Same
  // shape: open ceiling, bare assignment at iterate_ik_3d.cpp:177, and no
  // is_finite guard, so `inf` is accepted above the open end.
  min_distance: v.float('min_distance', { min: 0, hinted: 'iterate_ik_3d.cpp:395' }),

  // iterate_ik_3d.cpp:396, PROPERTY_HINT_RANGE "0,180,0.001,radians_as_degrees": the inspector shows
  // degrees, the .tscn stores radians, so 180 is a stored PI. IterateIK3D.xml's default 0.034906585
  // is deg_to_rad(2) (iterate_ik_3d.h:255), which proves the unit. set_angular_delta_limit (iterate_ik_3d.cpp:185)
  // assigns straight through, so both ends warn.
  angular_delta_limit: v.radians('angular_delta_limit', {
    minDeg: 0,
    maxDeg: 180,
    hinted: 'iterate_ik_3d.cpp:396',
  }),

  // iterate_ik_3d.cpp:397, Variant::BOOL with no hint. set_deterministic
  // (iterate_ik_3d.cpp:193) is a bare assignment.
  deterministic: v.boolean('deterministic'),

  // iterate_ik_3d.cpp:398, ADD_ARRAY_COUNT. IterateIK3D::set_setting_count (iterate_ik_3d.h:287)
  // forwards to IKModifier3D's `_set_setting_count`.
  setting_count: settingCount('IKModifier3D'),

  'settings/*': settingsValidator,
});
