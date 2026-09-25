/**
 * TwoBoneIK3D strict validators. doc/classes/TwoBoneIK3D.xml lists only `setting_count`, but
 * `_get_property_list` (two_bone_ik_3d.cpp:129-160) pushes 14 PropertyInfos per setting under
 * `"settings/" + itos(i) + "/"`, and `_set`/`_get` (two_bone_ik_3d.cpp:33-127) route them by leaf
 * name. No `ADD_PROPERTY` declares them.
 */

// The NODE_BASE_TYPES base-walk delivers every key from IKModifier3D up, `mutable_bone_axes` among
// them. Re-declaring one shadows it and duplicates the rule.
import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import { settingCount } from '../shared/settingCount.js';
import {
  BONE_DIRECTION,
  SECONDARY_DIRECTION,
} from '../skeletonmodifier3d/linterParser.js';

/** Error code for a `settings/…` key whose shape or leaf name is unrecognised. */
const UNKNOWN_SETTING_CODE = 'INVALID_SETTING_KEY';
/** Error code for a `settings/…` key addressing a negative setting. */
const NEGATIVE_SETTING_INDEX_CODE = 'INVALID_SETTING_INDEX';

function negativeIndexMessage(index: string): string {
  return (
    `Setting index ${index} must be non-negative. TwoBoneIK3D::_set opens with ` +
    'ERR_FAIL_INDEX_V(which, settings.size(), false) (two_bone_ik_3d.cpp:39), so the ' +
    'write is refused and never reaches a setter'
  );
}

/**
 * All 14 leaves, keyed by their path below the index, in the order `_get_property_list` pushes them
 * (two_bone_ik_3d.cpp:140-153). The bone index setters rewrite an index `<= -1` or past the bone
 * count to -1 once a skeleton resolves (two_bone_ik_3d.cpp:231, 268, 307): -2 is altered, and -1,
 * the unset default, stays legal. `v.strictInt`, so `2.5` is reported.
 */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // two_bone_ik_3d.cpp:140, Variant::NODE_PATH, no hint. set_target_node
  // (two_bone_ik_3d.cpp:403-407) is a bare assignment.
  target_node: v.nodePath('target_node'),
  // two_bone_ik_3d.cpp:141, Variant::NODE_PATH, no hint. set_pole_node
  // (two_bone_ik_3d.cpp:414-418) is a bare assignment.
  pole_node: v.nodePath('pole_node'),
  // two_bone_ik_3d.cpp:142, Variant::STRING, PROPERTY_HINT_ENUM_SUGGESTION over
  // the skeleton's bone names: a dropdown that still accepts free text, so it
  // constrains nothing. set_root_bone_name (two_bone_ik_3d.cpp:211) assigns and
  // then resolves the name against the skeleton.
  root_bone_name: v.quotedString('root_bone_name'),
  // two_bone_ik_3d.cpp:143, Variant::INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR (which still
  // serialises). The ceiling is the live bone count, which no per-property validator sees.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'two_bone_ik_3d.cpp:231' }),
  // two_bone_ik_3d.cpp:144, as root_bone_name.
  middle_bone_name: v.quotedString('middle_bone_name'),
  // two_bone_ik_3d.cpp:145, as root_bone.
  middle_bone: v.strictInt('middle_bone', { min: -1, enforced: 'two_bone_ik_3d.cpp:268' }),
  // two_bone_ik_3d.cpp:146, Variant::INT, PROPERTY_HINT_ENUM "None,+X,-X,+Y,-Y,+Z,-Z,Custom"
  // (skeleton_modifier_3d.h:77), values 0-7. set_pole_direction (two_bone_ik_3d.cpp:425-437)
  // static_casts and assigns with no range guard, so an out-of-range value loads and only warns.
  pole_direction: v.enumInt('pole_direction', 0, 7, SECONDARY_DIRECTION, {
    hinted: 'two_bone_ik_3d.cpp:146',
  }),
  // two_bone_ik_3d.cpp:147, Variant::VECTOR3, no hint. set_pole_direction_vector
  // (two_bone_ik_3d.cpp:444-458) normalises internally and bounds nothing; that
  // it drops the write entirely unless pole_direction is Custom is a cross-field
  // condition, so it lives in linter.ts.
  pole_direction_vector: v.vector3('pole_direction_vector'),
  // two_bone_ik_3d.cpp:148, as root_bone_name.
  end_bone_name: v.quotedString('end_bone_name'),
  // two_bone_ik_3d.cpp:149, as root_bone.
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'two_bone_ik_3d.cpp:307' }),
  // two_bone_ik_3d.cpp:150, Variant::BOOL, no hint. set_use_virtual_end
  // (two_bone_ik_3d.cpp:325-338) is a bare assignment.
  use_virtual_end: v.boolean('use_virtual_end'),
  // two_bone_ik_3d.cpp:151, Variant::BOOL, no hint. set_extend_end_bone
  // (two_bone_ik_3d.cpp:345-357) is a bare assignment.
  extend_end_bone: v.boolean('extend_end_bone'),
  // The two four-segment leaves, routed by `_set`'s inner `opt` switch (two_bone_ik_3d.cpp:60-69).
  // two_bone_ik_3d.cpp:152, Variant::INT, PROPERTY_HINT_ENUM "+X,-X,+Y,-Y,+Z,-Z,FromParent"
  // (skeleton_modifier_3d.h:64), values 0-6. set_end_bone_direction (two_bone_ik_3d.cpp:364-378)
  // static_casts and assigns with no range guard: a warning.
  'end_bone/direction': v.enumInt('end_bone/direction', 0, 6, BONE_DIRECTION, {
    hinted: 'two_bone_ik_3d.cpp:152',
  }),
  // two_bone_ik_3d.cpp:153, Variant::FLOAT, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m":
  // only the 0 floor bounds. set_end_bone_length (two_bone_ik_3d.cpp:385-396) assigns with no clamp
  // and no is_finite guard, so a negative length loads and runs: a warning.
  'end_bone/length': v.float('end_bone/length', { min: 0, hinted: 'two_bone_ik_3d.cpp:153' }),
};

/** The whole `settings/<i>/…` family, flat and nested leaves alike. */
const settingValidator = indexedFamilyValidator({
  // `_set` reads the index with a bare `to_int` and no `is_valid_int` gate (two_bone_ik_3d.cpp:37),
  // and `_to_int` skips non-digits (ustring.cpp:2268-2298), so `settings/first/x` lands on setting
  // 0. `PropertyListHelper` behaves otherwise.
  indexParse: 'to_int',
  prefix: 'settings/',
  leaves: SETTING_LEAVES,
  unknownCode: UNKNOWN_SETTING_CODE,
  describes: 'setting',
  // No angle brackets: the sheet generator drops this straight into a Markdown
  // table cell (lintCoverage.mjs:131), where `<i>` would open italics.
  accepts: 'per-setting bone chain, pole direction and virtual end-bone setup',
  negativeIndex: {
    cite: 'two_bone_ik_3d.cpp:39',
    code: NEGATIVE_SETTING_INDEX_CODE,
    message: negativeIndexMessage,
  },
});

validatorRegistry.registerAll('TwoBoneIK3D', {
  // two_bone_ik_3d.cpp:506, ADD_ARRAY_COUNT on this class, since IKModifier3D never calls the
  // macro. TwoBoneIK3D::set_setting_count (two_bone_ik_3d.h:267) forwards to IKModifier3D's
  // `_set_setting_count<T>`.
  setting_count: settingCount('IKModifier3D'),

  // A plain wildcard, not `settings/#/*`: the registry's glued-index matcher routes a single leaf
  // segment only, and two of the 14 leaves take two segments (two_bone_ik_3d.cpp:152-153).
  // `indexedFamilyValidator` ends the index at the first `/` past the prefix, so it reads both
  // shapes.
  'settings/*': settingValidator,
});
