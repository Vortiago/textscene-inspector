/**
 * SpringBoneSimulator3D strict validators for linting.
 *
 * Declare only SpringBoneSimulator3D's OWN members. `active` and `influence`
 * are SkeletonModifier3D's and arrive through the NODE_BASE_TYPES base-walk;
 * re-declaring either would shadow it.
 *
 * ## Three routes, and the serialised surface is mostly the third
 *
 * doc/classes/SpringBoneSimulator3D.xml lists three members, and the class binds
 * exactly two `ADD_PROPERTY` calls plus one `ADD_ARRAY_COUNT`
 * (spring_bone_simulator_3d.cpp:1336-1338). Everything else is a hand-rolled
 * `settings/<i>/…` family: `_set` (:38), `_get` (:158) and `_get_property_list`
 * (:282) parse and emit it with `get_slicec('/', n)`, and the XML documents it
 * as methods only. Reading the members list alone would conclude this class
 * serialises three keys; it serialises some forty per bone chain.
 *
 * ## The index parse is `to_int`, not `is_valid_int`
 *
 * `_set` reads the setting index with a BARE `int which = path.get_slicec('/',
 * 1).to_int();` (:42) and no `is_valid_int()` gate. `_to_int` skips non-digits
 * rather than stopping at them (ustring.cpp:2268-2298), so `settings/first/…`
 * resolves to setting 0 and the write LANDS. Reporting a non-numeric index is
 * the `PropertyListHelper` behaviour, which this class does not use, so the
 * dispatcher below passes `indexParse: 'to_int'`. A NEGATIVE index is refused by
 * the `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)` that follows at
 * :44, and that one is an error.
 *
 * ## No `radians_as_degrees` anywhere in this class
 *
 * Every angle-adjacent float here (`end_bone/length`, the joint radii) is a
 * LENGTH or a coefficient behind a plain `PROPERTY_HINT_RANGE`; the rotation
 * axes are enums and Vector3s. So no `v.radians` conversion applies, and the
 * hint numbers below are the stored numbers.
 *
 * ## Where the leaf set closes, and where it deliberately does not bite
 *
 * SpringBoneSimulator3D has no subclasses in Godot 4.6.3, so no descendant can
 * extend this family and an unrecognised leaf really is refused: `_set` falls to
 * `return false` at :151-152 for an unknown top-level leaf and at :138-139 for
 * an unknown `joints/<j>/` leaf. One narrow over-reach comes with that closure:
 * `_set` reads at most two segments below the index, so `settings/0/radius/
 * value/junk` still lands on `set_radius` while this reports it as unknown. No
 * serialiser and no inspector writes a key of that shape.
 *
 * The family's leaves live beside this file — `settingLeaves`, `jointLeaves`,
 * the shared `nonZeroVector3` bound, and the `settingsDispatch` that routes a
 * key to one of them — so this one stays the map of what the class declares.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { settingsValidator } from './settingsDispatch.js';

validatorRegistry.registerAll('SpringBoneSimulator3D', {
  // :1336, ADD_PROPERTY(PropertyInfo(Variant::VECTOR3, "external_force",
  // PROPERTY_HINT_RANGE, "-99999,99999,or_greater,or_less,hide_control,
  // suffix:m/s")). BOTH ends are opened, so the hint bounds nothing, and
  // set_external_force (:1212) is a bare assignment: format check only.
  external_force: v.vector3('external_force'),

  // :1337, Variant::BOOL with no hint. set_mutable_bone_axes (:1220) assigns.
  mutable_bone_axes: v.boolean('mutable_bone_axes'),

  // :1338, ADD_ARRAY_COUNT, which really is a serialised INT property
  // (class_db.cpp:1492) but carries PROPERTY_HINT_NONE, so there is no hint to
  // bound it. The floor comes from the setter: set_setting_count opens with
  // ERR_FAIL_COND(p_count < 0) (:841), so a negative count is an error.
  setting_count: v.strictInt('setting_count', {
    min: 0,
    enforced: 'spring_bone_simulator_3d.cpp:841',
  }),

  'settings/*': settingsValidator,
});
