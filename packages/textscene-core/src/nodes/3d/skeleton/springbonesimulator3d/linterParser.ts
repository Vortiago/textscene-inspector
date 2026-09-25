/**
 * SpringBoneSimulator3D strict validators: the map of what the class declares.
 * doc/classes/SpringBoneSimulator3D.xml lists three members (two `ADD_PROPERTY` and one
 * `ADD_ARRAY_COUNT`, spring_bone_simulator_3d.cpp:1336-1338), but `_set` (:38), `_get` (:158) and
 * `_get_property_list` (:282) serialise some forty more per bone chain as `settings/<i>/…`.
 */

// `active` and `influence` are SkeletonModifier3D's and arrive through the NODE_BASE_TYPES
// base-walk. Re-declaring either would shadow it.
import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
// settingLeaves, jointLeaves, nonZeroVector3 and settingsDispatch hold the `settings/<i>/…` family.
import { settingsValidator } from './settingsDispatch.js';

validatorRegistry.registerAll('SpringBoneSimulator3D', {
  // :1336, ADD_PROPERTY(PropertyInfo(Variant::VECTOR3, "external_force", PROPERTY_HINT_RANGE,
  // "-99999,99999,or_greater,or_less,hide_control,suffix:m/s")). Both ends are open, so the hint
  // bounds nothing, and set_external_force (:1212) is a bare assignment: format check only.
  external_force: v.vector3('external_force'),

  // :1337, Variant::BOOL with no hint. set_mutable_bone_axes (:1220) assigns.
  mutable_bone_axes: v.boolean('mutable_bone_axes'),

  // :1338, ADD_ARRAY_COUNT, a serialised INT property (class_db.cpp:1492) with PROPERTY_HINT_NONE,
  // so no hint bounds it. set_setting_count opens with ERR_FAIL_COND(p_count < 0) (:841), so a
  // negative count is an error.
  setting_count: v.strictInt('setting_count', {
    min: 0,
    enforced: 'spring_bone_simulator_3d.cpp:841',
  }),

  // `_set` reads the setting index with a bare `get_slicec('/', 1).to_int()` (:42) and no
  // `is_valid_int()` gate, and `_to_int` skips non-digits (ustring.cpp:2268-2298), so
  // `settings/first/…` lands on setting 0, unlike under `PropertyListHelper`. A negative index
  // fails `ERR_FAIL_INDEX_V` (:44): an error.
  'settings/*': settingsValidator,
});
