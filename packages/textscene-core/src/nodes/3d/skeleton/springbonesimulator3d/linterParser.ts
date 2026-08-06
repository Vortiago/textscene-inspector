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
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry, type PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import {
  RESOURCE_REFERENCE_REGEX,
  VECTOR3_REGEX,
  accepts,
  propertyError,
  v,
} from '../../../../linter/validators/index.js';

/** PROPERTY_HINT_ENUM "X,Y,Z,All,Custom" (skeleton_modifier_3d.h:87). */
const ROTATION_AXIS: Record<number, string> = {
  0: 'X',
  1: 'Y',
  2: 'Z',
  3: 'All',
  4: 'Custom',
};

/** PROPERTY_HINT_ENUM "+X,-X,+Y,-Y,+Z,-Z,FromParent" (skeleton_modifier_3d.h:64). */
const BONE_DIRECTION: Record<number, string> = {
  0: '+X',
  1: '-X',
  2: '+Y',
  3: '-Y',
  4: '+Z',
  5: '-Z',
  6: 'FromParent',
};

/** PROPERTY_HINT_ENUM "WorldOrigin,Node,Bone" (spring_bone_simulator_3d.cpp:300). */
const CENTER_FROM: Record<number, string> = {
  0: 'WorldOrigin',
  1: 'Node',
  2: 'Bone',
};

/**
 * `CMP_EPSILON` (math_defs.h:50), the tolerance `Math::is_zero_approx` compares
 * each component against (math_funcs.h:554-556).
 */
const CMP_EPSILON = 0.00001;

/**
 * A `Curve` slot, which Godot writes as a bare `null` when it is unset.
 *
 * All four damping curves are `PROPERTY_HINT_RESOURCE_TYPE, "Curve"` OBJECT
 * properties emitted unconditionally by `_get_property_list`
 * (spring_bone_simulator_3d.cpp:308, 310, 312, 314), so every serialised bone
 * chain carries all four whether or not a curve is assigned, and
 * `VariantWriter` stores the string `null` for an OBJECT with no validated
 * object (variant_parser.cpp's `Variant::OBJECT` case). A plain
 * `v.resourceReference` would reject the form the engine itself saves.
 *
 * Format-only: the setters (:656, :690, :724, :758) assign whatever reference
 * they are given, so nothing but an unreadable token is refused.
 */
function dampingCurve(name: string): PropertyValidator {
  const validator = accepts((key, value, line) => {
    if (value === 'null' || RESOURCE_REFERENCE_REGEX.test(value)) return null;
    return propertyError(
      key,
      line,
      `Property '${name}' must be null, SubResource("id"), or ExtResource("id"), got: "${value}"`,
      `INVALID_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FORMAT`,
    );
  }, 'null, SubResource("id"), or ExtResource("id")');
  validator.formatOnly = true;
  return validator;
}

/**
 * A gravity direction, which the setter refuses outright when it is zero.
 *
 * `set_gravity_direction` and `set_joint_gravity_direction` both open with
 * `ERR_FAIL_COND(p_gravity_direction.is_zero_approx())`, so the write never
 * lands and the previous direction stays. Not `=== 0`:
 * `Vector3::is_zero_approx` is `is_zero_approx(x) && is_zero_approx(y) &&
 * is_zero_approx(z)` (vector3.cpp:149-151), each a `abs(v) < CMP_EPSILON`
 * comparison, so `Vector3(0.000001, 0, 0)` is refused just as `Vector3(0, 0, 0)`
 * is.
 *
 * No `finite:` citation: `abs(nan) < CMP_EPSILON` is false, and so is
 * `abs(inf) < CMP_EPSILON`, so a non-finite component makes the vector NOT
 * zero-approx and Godot's guard lets it through. The linter's component grammar
 * spells all four non-finite literals, so such a value reaches this bound rather
 * than being turned away as a format error first.
 *
 * @param name - the leaf name, for the message.
 * @param cite - `file:line` of that leaf's own `ERR_FAIL_COND`.
 */
function nonZeroVector3(name: string, cite: string): PropertyValidator {
  const code = `INVALID_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_VALUE`;
  const validator = accepts((key, value, line) => {
    const match = VECTOR3_REGEX.exec(value);
    if (!match) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be Vector3 with 3 numbers like Vector3(0, -1, 0), got: "${value}"`,
        `INVALID_${name.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_FORMAT`,
      );
    }
    // `parseFloat`, not `tupleComponent`: the components are only ever tested
    // for ZERO-ness, and a non-finite one answers "not zero" whether it reads as
    // NaN or as Infinity. There is no bound here for the coarser parse to stop
    // applying to.
    const components = [match[1], match[2], match[3]].map((c) => parseFloat(c ?? '0'));
    if (components.every((c) => Math.abs(c) < CMP_EPSILON)) {
      return propertyError(
        key,
        line,
        `Property '${name}' must not be the zero vector: Godot's setter fails ` +
          `ERR_FAIL_COND(is_zero_approx()) and drops the write, and every component ` +
          `under ${CMP_EPSILON} counts as zero`,
        code,
      );
    }
    return null;
  }, 'Vector3(x, y, z), not the zero vector');
  validator.grounding = { kind: 'enforced', cite };
  return validator;
}

/**
 * `settings/<i>/<leaf>`, keyed by the leaf path exactly as `_get_property_list`
 * spells it (spring_bone_simulator_3d.cpp:293-339), so the two-segment
 * `end_bone/direction` and `radius/value` are ordinary entries.
 *
 * The `PROPERTY_HINT_ENUM_SUGGESTION` bone names are a suggestion list rather
 * than a constraint (the skeleton supplies them at :286, and it may be absent),
 * so each name leaf is a plain quoted string.
 */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // :293, Variant::STRING. set_root_bone_name (:440) assigns before resolving.
  root_bone_name: v.quotedString('root_bone_name'),

  // :294, Variant::INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR, which IS
  // storage. -1 is the unset sentinel the setter itself writes: set_root_bone
  // rewrites anything at or below -1 to -1 once a skeleton is present
  // (:460-462), and _validate_bone_names (:1355) re-runs the same setter on the
  // first skeleton update, so a value under -1 cannot survive as written. The
  // upper bound is the live bone count, which no per-property rule can see.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'spring_bone_simulator_3d.cpp:460-462' }),

  // :295, same shape as root_bone_name; set_end_bone_name is :477.
  end_bone_name: v.quotedString('end_bone_name'),

  // :296. set_end_bone applies the identical clamp to -1 (:497-499).
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'spring_bone_simulator_3d.cpp:497-499' }),

  // :297, Variant::BOOL. set_extend_end_bone (:515) assigns.
  extend_end_bone: v.boolean('extend_end_bone'),

  // :298, PROPERTY_HINT_ENUM over get_hint_bone_direction(), values 0-6 in the
  // BoneDirection declaration order (skeleton_modifier_3d.h:56-62).
  // set_end_bone_direction (:527) stores the static_cast unchecked, so the hint
  // governs the inspector only: warning.
  'end_bone/direction': v.enumInt('end_bone/direction', 0, 6, BONE_DIRECTION, {
    hinted: 'spring_bone_simulator_3d.cpp:298',
  }),

  // :299, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". `or_greater`
  // opens the max end, so only the floor is reportable, and set_end_bone_length
  // (:544) assigns straight through: warning. No is_finite guard, so inf and nan
  // are values it keeps.
  'end_bone/length': v.float('end_bone/length', {
    min: 0,
    hinted: 'spring_bone_simulator_3d.cpp:299',
  }),

  // :300, PROPERTY_HINT_ENUM "WorldOrigin,Node,Bone". set_center_from (:576)
  // stores the static_cast unchecked: warning.
  center_from: v.enumInt('center_from', 0, 2, CENTER_FROM, {
    hinted: 'spring_bone_simulator_3d.cpp:300',
  }),

  // :301, Variant::NODE_PATH with no hint. set_center_node (:591) assigns.
  center_node: v.nodePath('center_node'),

  // :302, same shape as root_bone_name; set_center_bone_name is :605.
  center_bone_name: v.quotedString('center_bone_name'),

  // :303. set_center_bone applies the same clamp to -1 (:625-627).
  center_bone: v.strictInt('center_bone', {
    min: -1,
    enforced: 'spring_bone_simulator_3d.cpp:625-627',
  }),

  // :304, Variant::BOOL. set_individual_config (:870) assigns. Which of the two
  // config blocks below is live depends on it, and that is linter.ts's.
  individual_config: v.boolean('individual_config'),

  // :305, PROPERTY_HINT_ENUM over get_hint_rotation_axis(), values 0-4
  // (skeleton_modifier_3d.h:81-85). set_rotation_axis (:793) assigns the
  // static_cast: warning.
  rotation_axis: v.enumInt('rotation_axis', 0, 4, ROTATION_AXIS, {
    hinted: 'spring_bone_simulator_3d.cpp:305',
  }),

  // :306, Variant::VECTOR3 with no hint. set_rotation_axis_vector (:808)
  // assigns any vector; a zero one is legal and reads as ROTATION_AXIS_ALL.
  rotation_axis_vector: v.vector3('rotation_axis_vector'),

  // :307, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". Open ceiling, and
  // set_radius (:642) assigns straight through: warning on the floor only.
  'radius/value': v.float('radius/value', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:307' }),
  'radius/damping_curve': dampingCurve('radius/damping_curve'),

  // :309, PROPERTY_HINT_RANGE "0,4,0.01,or_greater". set_stiffness (:676)
  // assigns straight through.
  'stiffness/value': v.float('stiffness/value', {
    min: 0,
    hinted: 'spring_bone_simulator_3d.cpp:309',
  }),
  'stiffness/damping_curve': dampingCurve('stiffness/damping_curve'),

  // :311, PROPERTY_HINT_RANGE "0,1,0.01,or_greater". set_drag (:710) assigns
  // straight through.
  'drag/value': v.float('drag/value', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:311' }),
  'drag/damping_curve': dampingCurve('drag/damping_curve'),

  // :313, PROPERTY_HINT_RANGE "0,1,0.01,or_greater,or_less,suffix:m/s". BOTH
  // ends are opened, so there is no bound to report at all: gravity is a signed
  // constant velocity and a negative one is ordinary. Format check only.
  'gravity/value': v.float('gravity/value'),
  'gravity/damping_curve': dampingCurve('gravity/damping_curve'),

  // :315, Variant::VECTOR3, and the one leaf whose setter refuses a value.
  'gravity/direction': nonZeroVector3(
    'gravity/direction',
    'spring_bone_simulator_3d.cpp:780',
  ),

  // :316, Variant::INT with PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY, so it
  // carries STORAGE (object.h). set_joint_count opens with
  // ERR_FAIL_COND(p_count < 0) (:1054), which refuses the write outright.
  joint_count: v.strictInt('joint_count', {
    min: 0,
    enforced: 'spring_bone_simulator_3d.cpp:1054',
  }),

  // :329, Variant::BOOL. set_enable_all_child_collisions (:1081) assigns. It
  // selects WHICH of the two collision lists is live, which is linter.ts's.
  enable_all_child_collisions: v.boolean('enable_all_child_collisions'),

  // :330 and :335, both PROPERTY_HINT_NONE, so no hint bounds them, and NEITHER
  // setter carries the `ERR_FAIL_COND(p_count < 0)` that setting_count (:841)
  // and joint_count (:1054) have: set_exclude_collision_count (:1123) and
  // set_collision_count (:1179) hand the value straight to
  // `LocalVector::resize`, whose `_resize` (local_vector.h:54-71) has no guard
  // of its own. There is no line to cite for a floor, so no floor is claimed.
  exclude_collision_count: v.int('exclude_collision_count'),
  collision_count: v.int('collision_count'),
};

/**
 * `settings/<i>/joints/<j>/<leaf>`, pushed at
 * spring_bone_simulator_3d.cpp:319-327.
 *
 * ## `bone` and `bone_name` are written by Godot and refused on load, and that
 * is not a diagnostic
 *
 * Both are declared WITHOUT `PROPERTY_USAGE_STORAGE` (:319-320), and
 * `_validate_dynamic_prop` then XORs that flag over every `joints/` key when
 * `individual_config` is false (:382), which ADDS storage to exactly these two
 * while removing it from the six tunables beside them. So a scene Godot saves in
 * the default shared mode carries `settings/<i>/joints/<j>/bone` and
 * `bone_name`, and `_set`'s joints branch has no case for either, so both fall
 * to `return false` (:138-139) and the write is dropped.
 *
 * Dropping it loses nothing: `_update_joints` (:1561) rebuilds the joint list
 * from `root_bone`/`end_bone` and re-derives the identical values. Reporting it
 * would fire on every Godot-authored SpringBoneSimulator3D in the default mode,
 * so both stay format checks. (ChainIK3D's slice makes this an error for the
 * same-looking keys; there the usage flags really do keep them out of the file,
 * because that class has no XOR.)
 */
const JOINT_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  bone_name: v.quotedString('bone_name'),
  bone: v.strictInt('bone'),

  // :321, PROPERTY_HINT_ENUM over get_hint_rotation_axis().
  // set_joint_rotation_axis (:1001) assigns the static_cast: warning.
  rotation_axis: v.enumInt('rotation_axis', 0, 4, ROTATION_AXIS, {
    hinted: 'spring_bone_simulator_3d.cpp:321',
  }),

  // :322, Variant::VECTOR3 with no hint.
  rotation_axis_vector: v.vector3('rotation_axis_vector'),

  // :323, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". set_joint_radius
  // (:912) assigns straight through once its individual-config gate passes.
  radius: v.float('radius', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:323' }),

  // :324, PROPERTY_HINT_RANGE "0,4,0.01,or_greater". set_joint_stiffness (:932)
  // assigns straight through.
  stiffness: v.float('stiffness', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:324' }),

  // :325, PROPERTY_HINT_RANGE "0,1,0.01,or_greater". set_joint_drag (:949)
  // assigns straight through.
  drag: v.float('drag', { min: 0, hinted: 'spring_bone_simulator_3d.cpp:325' }),

  // :326, "0,1,0.01,or_greater,or_less,suffix:m/s". Both ends open: no bound.
  gravity: v.float('gravity'),

  // :327, and the joint-level twin of the setting's gravity/direction.
  gravity_direction: nonZeroVector3(
    'gravity_direction',
    'spring_bone_simulator_3d.cpp:985',
  ),
};

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

/** `[+-]?`, matching `String::to_int()`'s sign handling. */
const INT_RE = /^[+-]?\d+$/;

/**
 * The negative-setting-index branch every level shares, or null when the index
 * is not a negative integer. A non-numeric index is left alone: `_to_int`
 * resolves it to some setting and the write lands.
 */
function negativeIndexError(indexText: string, key: string, line: number) {
  if (!INT_RE.test(indexText)) return null;
  const index = Number(indexText);
  if (index >= 0) return null;
  return propertyError(key, line, negativeSettingIndex(index), 'INVALID_SETTING_INDEX');
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
const settingsValidator = accepts((key, value, line) => {
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
