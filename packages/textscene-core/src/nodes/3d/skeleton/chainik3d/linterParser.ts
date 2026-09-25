/**
 * Validators for every ChainIK3D-derived node, under the abstract key 'ChainIK3D', which Godot cannot
 * instantiate. The base-walk delivers them to IterateIK3D and SplineIK3D, and through IterateIK3D to
 * CCDIK3D, FABRIK3D and JacobianIK3D. chain_ik_3d.cpp has no `ADD_PROPERTY`, and
 * doc/classes/ChainIK3D.xml lists methods only.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { BONE_DIRECTION } from '../skeletonmodifier3d/linterParser.js';
import { declaredLeafResolver, indexedKeyRegex } from '../../../../godot/index.js';
import { negativeIndexError } from '../../../../linter/reportedIndices.js';

// The surface is a hand-built `settings/<i>/<leaf>` family: `_set` (chain_ik_3d.cpp:33) and `_get`
// (:69) parse it with `get_slicec('/', n)`, and `get_property_list` (:115) emits
// `"settings/" + itos(i) + "/"` (:125). That method is unprefixed (chain_ik_3d.h:208), and the
// subclasses call it (iterate_ik_3d.cpp:129, spline_ik_3d.cpp:94), so a grep misses it.
const SETTINGS_PREFIX = 'settings/';

/**
 * `joints/<j>/bone` and `joints/<j>/bone_name`, at any `to_int` index: `_set` has no `joints` branch,
 * so every spelling falls to the same `return false` (chain_ik_3d.cpp:62-63) and only the leaf
 * names count.
 */
const JOINT_BONE_RE = indexedKeyRegex('^joints/#/(?:bone|bone_name)$', 'to_int');

/**
 * The joint list is derived, never written. `_update_joints` (chain_ik_3d.cpp:411) rebuilds it from
 * the skeleton, and neither PropertyInfo carries `PROPERTY_USAGE_STORAGE` (object.h:101):
 * `PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY` for `bone_name` (:136), a bare
 * `PROPERTY_USAGE_READ_ONLY` for `bone` (:137). Not `registerUnavailable`: its keys are exact strings.
 */
const jointBoneReadOnly = v.readOnly('settings_joint', {
  derivedFrom: "ChainIK3D's root_bone and end_bone",
  // `_set`'s false return drops the write, ADR-0032's error row: `_setv` is `Object::set`'s last
  // resort (object.cpp:427), after the script, `ClassDB::set_property` and `metadata/` decline
  // (object.cpp:363-411). It leaves only `r_valid = false` (:435-437), which
  // `SceneState::instantiate` ignores (packed_scene.cpp:492).
  cite: 'chain_ik_3d.cpp:62-63',
  code: 'INVALID_SETTINGS_JOINT_READONLY',
});

/**
 * `settings/<i>/<leaf>` leaves, keyed by the leaf path exactly as
 * `get_property_list` spells it (chain_ik_3d.cpp:126-133), so the two-segment
 * `end_bone/direction` and `end_bone/length` are ordinary entries.
 */
const SETTING_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // chain_ik_3d.cpp:126, Variant::STRING, PROPERTY_HINT_ENUM_SUGGESTION over
  // the skeleton's bone names, a suggestion list, not a constraint, and
  // set_root_bone_name (:166) assigns whatever it is given before resolving it.
  root_bone_name: v.quotedString('root_bone_name'),

  // chain_ik_3d.cpp:127, INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR, which is storage
  // (object.h:132). set_root_bone rewrites anything below -1 to the unset -1 (:186-188), and
  // _validate_bone_names (:379-383) re-runs it on the first skeleton update. The live bone count is
  // the ceiling. `strictInt`: Variant conversion would truncate a decimal.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'chain_ik_3d.cpp:186-188' }),

  // chain_ik_3d.cpp:128, same hint and same non-constraint as root_bone_name.
  // set_end_bone_name is :203.
  end_bone_name: v.quotedString('end_bone_name'),

  // chain_ik_3d.cpp:129. set_end_bone (:223-225) applies the identical clamp to
  // -1, re-run from _validate_bone_names (:385-388).
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'chain_ik_3d.cpp:223-225' }),

  // chain_ik_3d.cpp:130, Variant::BOOL. set_extend_end_bone (:241) assigns.
  extend_end_bone: v.boolean('extend_end_bone'),

  // chain_ik_3d.cpp:131, PROPERTY_HINT_ENUM "+X,-X,+Y,-Y,+Z,-Z,FromParent" (skeleton_modifier_3d.h:64),
  // values 0-6 in BoneDirection order (skeleton_modifier_3d.h:56-62). set_end_bone_direction (:260)
  // stores the static_cast unchecked, so the hint governs the inspector only: warning.
  'end_bone/direction': v.enumInt('end_bone/direction', 0, 6, BONE_DIRECTION, {
    hinted: 'chain_ik_3d.cpp:131',
  }),

  // chain_ik_3d.cpp:132, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m". `or_greater` opens the
  // max end, and set_end_bone_length (:281) assigns straight through: a floor warning. It has no
  // ERR_FAIL_COND(!is_finite(...)), so inf and nan are values it keeps.
  'end_bone/length': v.float('end_bone/length', { min: 0, hinted: 'chain_ik_3d.cpp:132' }),

  // chain_ik_3d.cpp:133, INT with `PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY` inline, and DEFAULT
  // carries STORAGE (object.h:131). set_joint_count refuses a negative (:333). `setting_count` is the
  // subclasses' (iterate_ik_3d.cpp:398, spline_ik_3d.cpp:185), with the floor in `_set_setting_count`
  // (ik_modifier_3d.h:98).
  joint_count: v.strictInt('joint_count', { min: 0, enforced: 'chain_ik_3d.cpp:333' }),
};

/**
 * The leaf `_set` reaches through a tail it ignores: `what = get_slicec('/', 2)` (chain_ik_3d.cpp:38)
 * makes `root_bone/extra` a write to `root_bone`.
 */
const resolveSettingLeaf = declaredLeafResolver(Object.keys(SETTING_LEAVES));

const negativeSettingIndex = (index: string): string =>
  `Setting index ${index} is out of range: Godot refuses a negative index and drops the write`;

/**
 * The `settings/<i>/` dispatcher. {@link negativeIndexError} reads the index as `_set` does
 * (chain_ik_3d.cpp:37), and `ERR_FAIL_INDEX_V` (:39) refuses a negative one, so `settings/a-1/...`
 * is refused and `settings/a1b2/...` is setting 12. An index past the live `setting_count` is a
 * sibling bound.
 */
const settingsFamily: PropertyValidator = accepts((key, value, line) => {
  if (!key.startsWith(SETTINGS_PREFIX)) return null;
  const rest = key.slice(SETTINGS_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;

  const negative = negativeIndexError(
    rest.slice(0, slash),
    key,
    line,
    negativeSettingIndex,
    'INVALID_SETTINGS_INDEX'
  );
  if (negative) return negative;

  const leafName = rest.slice(slash + 1);
  if (JOINT_BONE_RE.test(leafName)) return jointBoneReadOnly(key, value, line);
  // A subclass's leaf passes: IterateIK3D's `target_node` and `joints/<j>/` (iterate_ik_3d.cpp:117-125)
  // and SplineIK3D's `path_3d`/`tilt_*` (spline_ik_3d.cpp:83-86). A base cannot close a set its
  // descendants extend, so `indexedFamilyValidator`, whose `unknownCode` closes it, does not fit.
  const resolved = resolveSettingLeaf(leafName);
  if (resolved === null) return null;
  const leaf = SETTING_LEAVES[resolved];
  return leaf ? leaf(key, value, line) : null;
}, 'settings/<i>/ bone chain setup');

settingsFamily.grounding = { kind: 'enforced', cite: 'chain_ik_3d.cpp:39' };
settingsFamily.leaves = [...Object.values(SETTING_LEAVES), jointBoneReadOnly];

validatorRegistry.registerAll('ChainIK3D', {
  // Plain, not `settings/#/*`: `matchesIndexedKey` takes one leaf segment, so it misses
  // `end_bone/direction`, `end_bone/length` and `joints/<j>/bone`.
  'settings/*': settingsFamily,
});

// Exported for `settingsFamilySeam.test.ts`, which checks every leaf a base declares across every
// descendant. It derives the list from this table, so a new leaf joins the check.
export { SETTING_LEAVES as CHAIN_IK_SETTING_LEAVES };
