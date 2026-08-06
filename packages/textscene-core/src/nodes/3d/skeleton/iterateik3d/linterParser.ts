/**
 * Validators shared by every IterateIK3D-derived node.
 *
 * Registered under the abstract key 'IterateIK3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 3 subclasses (CCDIK3D, FABRIK3D, JacobianIK3D) through the NODE_BASE_TYPES
 * base-walk.
 *
 * Declare only IterateIK3D's OWN members: the ones doc/classes/IterateIK3D.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 */

// Load-bearing, not decorative: the `settings/*` dispatcher below hands every
// key it does not own back to ChainIK3D, and a base tier is only ever loaded by
// something that imports it. CCDIK3D, FABRIK3D and JacobianIK3D import THIS
// file and nothing else in the chain, so without this line ChainIK3D would
// register only when SplineIK3D happened to be loaded, and every ChainIK3D
// bound would silently disappear for the three IterateIK3D leaves.
import '../chainik3d/linterParser.js';
import { validatorRegistry, type PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { propertyError } from '../../../../linter/validators/propertyError.js';
import { accepts, v } from '../../../../linter/validators/v.js';
import {
  ROTATION_AXIS,
  SECONDARY_DIRECTION,
} from '../skeletonmodifier3d/linterParser.js';

/**
 * Why a negative setting index is refused, shared by both levels of the family
 * so the two report the same thing.
 */
const negativeSettingIndex = (index: number): string =>
  `Setting index ${index} must be non-negative; IterateIK3D::_set fails the index check (iterate_ik_3d.cpp:39) before reaching the property, so the write never lands`;


/**
 * `settings/<i>/joints/<j>/…`, pushed at iterate_ik_3d.cpp:120-125.
 *
 * Keyed by everything after the JOINT index, so `limitation/right_axis` is one
 * leaf name rather than a further nesting level. Every setter behind these is a
 * bare assignment guarded only by ERR_FAIL_INDEX on the two indices
 * (iterate_ik_3d.cpp:216-324), so each PROPERTY_HINT_ENUM warns and never
 * errors.
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
 * The depth-3 level, which is exactly the `<prefix><int>/<leaf>` shape the
 * shared dispatcher parses. It also supplies the negative-index branch: a
 * `.tscn` write enters through `_set`, whose first act is
 * `ERR_FAIL_INDEX_V(which, settings.size(), false)`, so the value never lands.
 */
const settingLeafValidator = indexedFamilyValidator({
  // `_set` reads the index with a BARE `to_int` and no `is_valid_int` gate
  // (iterate_ik_3d.cpp:37), and `_to_int` skips non-digits (ustring.cpp:2268-2298), so
  // `settings/first/x` resolves to setting 0 and the write LANDS. Reporting it
  // was a false positive: that is the PropertyListHelper behaviour, not this one.
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
 * The joint sub-tree, which the shared dispatcher cannot reach.
 *
 * `indexedFamilyValidator` splits at the LAST `/` and requires everything
 * between the prefix and that slash to be an integer, so for
 * `settings/0/joints/1/rotation_axis` it reads an index of `0/joints/1` and
 * gives up. One more level of nesting is one more level than the shape it
 * mirrors ever has.
 */
const JOINT_KEY = /^settings\/([+-]?\d+)\/joints\/[+-]?\d+\/(.+)$/;

/**
 * `settings/…` on IterateIK3D, which is HALF of a family ChainIK3D also builds.
 *
 * `_get_property_list` pushes IterateIK3D's own leaves and then calls
 * `ChainIK3D::get_property_list` (iterate_ik_3d.cpp:129), so one serialised
 * family has two owners. The base-walk resolves the FIRST matching wildcard, so
 * this registration shadows ChainIK3D's for every IterateIK3D descendant:
 * reporting an unrecognised leaf here would flag `settings/0/root_bone_name` on
 * a CCDIK3D that legitimately carries it. Anything this file does not own is
 * therefore handed back to ChainIK3D, which keeps the last word on a leaf name
 * neither tier declares. `findValidator` walks upwards only, so the hand-back
 * cannot return here.
 */
const settingsValidator = accepts((key, value, line) => {
  const joint = JOINT_KEY.exec(key);
  if (joint) {
    const leafName = joint[2]!;
    if (Object.prototype.hasOwnProperty.call(JOINT_LEAVES, leafName)) {
      // The joint index is deliberately unchecked: each leaf's ERR_FAIL_INDEX
      // sits in its own setter, so there is no single line to cite, and the
      // setting index below already covers what `_set` refuses uniformly.
      const settingIndex = Number(joint[1]!);
      if (settingIndex < 0) {
        return propertyError(
          key,
          line,
          negativeSettingIndex(settingIndex),
          'INVALID_SETTING_INDEX'
        );
      }
      return JOINT_LEAVES[leafName]!(key, value, line);
    }
  } else if (key.endsWith('/target_node')) {
    return settingLeafValidator(key, value, line);
  }

  const inherited = validatorRegistry.findValidator('ChainIK3D', key);
  return inherited ? inherited(key, value, line) : null;
}, 'IterateIK3D setting key, or the ChainIK3D setting key it inherits');

// The only value this dispatcher refuses on its own authority is a negative
// setting index, which `_set` refuses outright; every magnitude bound lives in
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

  // iterate_ik_3d.cpp:396, PROPERTY_HINT_RANGE "0,180,0.001,radians_as_degrees".
  // The flag means the inspector shows DEGREES while the .tscn stores RADIANS,
  // so the hint's 180 is a stored ceiling of PI. IterateIK3D.xml's documented
  // default of 0.034906585 is deg_to_rad(2) (iterate_ik_3d.h:255) and proves
  // the stored unit. set_angular_delta_limit (iterate_ik_3d.cpp:185) assigns
  // straight through, so both ends warn.
  angular_delta_limit: v.radians('angular_delta_limit', {
    maxDeg: 180,
    hinted: 'iterate_ik_3d.cpp:396',
  }),

  // iterate_ik_3d.cpp:397, Variant::BOOL with no hint. set_deterministic
  // (iterate_ik_3d.cpp:193) is a bare assignment.
  deterministic: v.boolean('deterministic'),

  // iterate_ik_3d.cpp:398, ADD_ARRAY_COUNT, which really is a serialised INT
  // property (class_db.cpp:1492) but carries PROPERTY_HINT_NONE, so there is no
  // hint to bound it. The floor comes from the setter instead:
  // IterateIK3D::set_setting_count (iterate_ik_3d.h:287) forwards to the shared
  // template `_set_setting_count`, which opens `ERR_FAIL_COND(p_count < 0)`
  // (ik_modifier_3d.h:98), so a negative count is an error, not a warning.
  setting_count: v.int('setting_count', { min: 0, enforced: 'ik_modifier_3d.h:98' }),

  'settings/*': settingsValidator,
});
