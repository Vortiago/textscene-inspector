/**
 * Validators shared by every ChainIK3D-derived node.
 *
 * Registered under the abstract key 'ChainIK3D', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches
 * IterateIK3D and SplineIK3D, and through IterateIK3D also CCDIK3D, FABRIK3D
 * and JacobianIK3D, through the NODE_BASE_TYPES base-walk.
 *
 * ## The class has ZERO `ADD_PROPERTY` calls and still has a serialised surface
 *
 * chain_ik_3d.cpp contains no `ADD_PROPERTY`, and doc/classes/ChainIK3D.xml
 * lists methods only. Reading either alone concludes the class declares
 * nothing. The whole surface is a `settings/<i>/<leaf>` family built by hand:
 * `_set` (chain_ik_3d.cpp:33) and `_get` (:69) parse the path with
 * `get_slicec('/', n)`, and `get_property_list` (:115) emits it as
 * `"settings/" + itos(i) + "/"` (:125). That method is UNPREFIXED
 * (`get_property_list`, not the `_get_property_list` virtual, chain_ik_3d.h:208)
 * and the subclasses call it explicitly (iterate_ik_3d.cpp:129,
 * spline_ik_3d.cpp:94), so it is invisible to the usual grep.
 *
 * The array COUNT for that family is not ChainIK3D's: `ADD_ARRAY_COUNT(...,
 * "setting_count", ...)` sits on the subclasses (iterate_ik_3d.cpp:398,
 * spline_ik_3d.cpp:185), and the floor it enforces lives in the base template
 * `_set_setting_count` (`ERR_FAIL_COND(p_count < 0)`, ik_modifier_3d.h:98).
 * `joint_count` IS ChainIK3D's: it is declared inline at :133 with
 * `PROPERTY_USAGE_DEFAULT | PROPERTY_USAGE_ARRAY` rather than through the
 * macro, and `PROPERTY_USAGE_DEFAULT` carries STORAGE (object.h:131).
 *
 * ## One plain `settings/*` wildcard, and it stays lenient
 *
 * The glued-index shape `settings/#/*` matches only `settings/<int>/<leaf>`
 * with a SINGLE leaf segment (`ValidatorRegistry.matchesIndexedKey`), so it
 * cannot reach `end_bone/direction`, `end_bone/length` or the nested
 * `joints/<j>/bone`. The family is registered under the plain prefix wildcard
 * instead, and the index parse is done here.
 *
 * That wildcard matches every key under `settings/`, including leaves the
 * SUBCLASSES add to the same family: `target_node` and a `joints/<j>/` block
 * on IterateIK3D (iterate_ik_3d.cpp:117-125), `path_3d`/`tilt_*` on SplineIK3D
 * (spline_ik_3d.cpp:83-86). A base cannot close a leaf set its descendants
 * extend, so an unrecognised leaf returns null rather than an "unknown
 * property" error, which is also why `indexedFamilyValidator` is not used
 * here, since its `unknownCode` branch encodes exactly that closure.
 */

import '../shared/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { BONE_DIRECTION } from '../skeletonmodifier3d/linterParser.js';
import { toIntIndex } from '../../../../godot/index.js';

const SETTINGS_PREFIX = 'settings/';

/**
 * `joints/<j>/bone` and `joints/<j>/bone_name`, at any index.
 *
 * The index is `[^/]+`, not digits: `_set` has no `joints` branch at all, so
 * every spelling falls to the same `return false` (chain_ik_3d.cpp:62-63) and
 * the index text decides nothing here. Only the two leaf names do.
 */
const JOINT_BONE_RE = /^joints\/[^/]+\/(?:bone|bone_name)$/;

/**
 * The joint list is DERIVED, never written.
 *
 * `_update_joints` (chain_ik_3d.cpp:411) rebuilds it by walking the skeleton
 * from the end bone up to the root bone, and the two PropertyInfos it emits
 * carry no STORAGE flag: `PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_READ_ONLY`
 * for `bone_name` (:136) and a bare `PROPERTY_USAGE_READ_ONLY` for `bone`
 * (:137), neither of which includes `PROPERTY_USAGE_STORAGE` (object.h:101).
 * So Godot never writes these keys, and `ChainIK3D::_set` has no `joints`
 * branch at all: the write falls to `return false` (:62-63).
 *
 * The write is then DROPPED, not stored anywhere: `_setv` runs base-first and
 * is `Object::set`'s last resort (object.cpp:427), reached only after the
 * script instance, `ClassDB::set_property` and the `metadata/` fallback have
 * all declined (object.cpp:363-411), and a false return leaves nothing behind
 * but `r_valid = false` (:435-437). `SceneState::instantiate` passes that
 * `valid` flag and never reads it (packed_scene.cpp:492). ADR-0032's error row
 * is "the setter refuses", which this is in its strongest form. It would be a
 * `registerUnavailable` removal if that took patterns, but its keys are exact
 * strings and this one carries two indices.
 */
const jointBoneReadOnly = v.readOnly('settings_joint', {
  derivedFrom: "ChainIK3D's root_bone and end_bone",
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
  // the skeleton's bone names, a suggestion list rather than a constraint, and
  // set_root_bone_name (:166) assigns whatever it is given before resolving it.
  root_bone_name: v.quotedString('root_bone_name'),

  // chain_ik_3d.cpp:127, Variant::INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_
  // NO_EDITOR, which IS storage (object.h:132). -1 is the unset sentinel the
  // setter itself writes (:188). Anything BELOW it is rewritten to -1 by
  // set_root_bone (:186-188) once a skeleton is present; at load time
  // get_skeleton() may still be null, but _validate_bone_names (:379-383)
  // re-runs the same setter on the first skeleton update, so a value under -1
  // cannot survive as written. The upper bound is the live bone count, which no
  // per-property rule can see. `strictInt`, since a bone index is discrete and
  // Godot's Variant conversion would truncate a decimal rather than keep it.
  root_bone: v.strictInt('root_bone', { min: -1, enforced: 'chain_ik_3d.cpp:186-188' }),

  // chain_ik_3d.cpp:128, same hint and same non-constraint as root_bone_name;
  // set_end_bone_name is :203.
  end_bone_name: v.quotedString('end_bone_name'),

  // chain_ik_3d.cpp:129. set_end_bone (:223-225) applies the identical clamp to
  // -1, re-run from _validate_bone_names (:385-388).
  end_bone: v.strictInt('end_bone', { min: -1, enforced: 'chain_ik_3d.cpp:223-225' }),

  // chain_ik_3d.cpp:130, Variant::BOOL. set_extend_end_bone (:241) assigns.
  extend_end_bone: v.boolean('extend_end_bone'),

  // chain_ik_3d.cpp:131, PROPERTY_HINT_ENUM over
  // SkeletonModifier3D::get_hint_bone_direction() "+X,-X,+Y,-Y,+Z,-Z,FromParent"
  // (skeleton_modifier_3d.h:64), values 0-6 in the BoneDirection declaration
  // order (skeleton_modifier_3d.h:56-62). set_end_bone_direction (:260) stores
  // the static_cast unchecked, so the hint governs the inspector only: warning.
  'end_bone/direction': v.enumInt('end_bone/direction', 0, 6, BONE_DIRECTION, {
    hinted: 'chain_ik_3d.cpp:131',
  }),

  // chain_ik_3d.cpp:132, PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m".
  // `or_greater` opens the max end, so only the floor is reportable, and
  // set_end_bone_length (:281) assigns straight through: warning, not error.
  // No ERR_FAIL_COND(!is_finite(...)) anywhere in that setter, so inf and nan
  // are values it keeps.
  'end_bone/length': v.float('end_bone/length', { min: 0, hinted: 'chain_ik_3d.cpp:132' }),

  // chain_ik_3d.cpp:133, Variant::INT with PROPERTY_USAGE_ARRAY: the count of
  // the nested `joints/` array. set_joint_count opens with
  // ERR_FAIL_COND(p_count < 0) (:333), which refuses the write outright.
  joint_count: v.strictInt('joint_count', { min: 0, enforced: 'chain_ik_3d.cpp:333' }),
};

/**
 * The `settings/<i>/` dispatcher.
 *
 * The index is read the way `_set` reads it — `path.get_slicec('/', 1).to_int()`
 * with no validity gate, chain_ik_3d.cpp:37 — so {@link toIntIndex} is the
 * parse and a negative result is refused by the following `ERR_FAIL_INDEX_V`
 * (:39), the write never landing.
 *
 * A non-numeric spelling is therefore an index like any other rather than no
 * index: `_to_int` skips non-digits instead of stopping at them
 * (ustring.cpp:2278-2294), so `settings/x/...` resolves to setting 0 and
 * `settings/a1b2/...` to setting 12, and the leaf below decides the value. A
 * `-` seen while the total is still 0 flips the sign (:2291-2292), which is how
 * `settings/a-1/...` reaches the negative-index refusal.
 *
 * The high end (an index at or past the live `setting_count`) is left alone,
 * being a bound against a sibling count no per-property validator can see.
 */
const settingsFamily: PropertyValidator = accepts((key, value, line) => {
  if (!key.startsWith(SETTINGS_PREFIX)) return null;
  const rest = key.slice(SETTINGS_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;

  const index = toIntIndex(rest.slice(0, slash));
  if (index < 0) {
    return propertyError(
      key,
      line,
      `Setting index ${index} is out of range: Godot refuses a negative index and drops the write`,
      'INVALID_SETTINGS_INDEX'
    );
  }

  const leafName = rest.slice(slash + 1);
  if (JOINT_BONE_RE.test(leafName)) return jointBoneReadOnly(key, value, line);
  if (!Object.prototype.hasOwnProperty.call(SETTING_LEAVES, leafName)) return null;
  const leaf = SETTING_LEAVES[leafName];
  return leaf ? leaf(key, value, line) : null;
}, 'settings/<i>/ bone chain setup');

settingsFamily.grounding = { kind: 'enforced', cite: 'chain_ik_3d.cpp:39' };
settingsFamily.leaves = [...Object.values(SETTING_LEAVES), jointBoneReadOnly];

validatorRegistry.registerAll('ChainIK3D', {
  'settings/*': settingsFamily,
});

// Exported for `settingsFamilySeam.test.ts`, which sweeps every leaf a base
// declares across every descendant rather than trusting one hand-picked canary.
// Deriving the sweep from this table is what keeps it 9-of-9 as leaves are added.
export { SETTING_LEAVES as CHAIN_IK_SETTING_LEAVES };
