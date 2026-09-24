/**
 * SplineIK3D strict validators. SplineIK3D.xml lists only `setting_count`, but `_set`
 * (spline_ik_3d.cpp:33) and `_get` (:56) also serialise four leaves in the `settings/<i>/` family
 * ChainIK3D owns. None of the four is an angle, so no `radians_as_degrees` conversion applies.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/v.js';
// Declare only SplineIK3D's own members, the ones doc/classes/SplineIK3D.xml lists without
// `overrides=`. The NODE_BASE_TYPES base-walk delivers every key from ChainIK3D up, and
// re-declaring one shadows it and duplicates the rule.
import '../chainik3d/linterParser.js';

/**
 * The four leaves SplineIK3D adds to the inherited `settings/<i>/` family, keyed as
 * `_get_property_list` (:79) spells them (spline_ik_3d.cpp:83-86) under
 * `"settings/" + itos(i) + "/"` (:82), before it chains to `ChainIK3D::get_property_list` (:94).
 */
const OWN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // spline_ik_3d.cpp:83, Variant::NODE_PATH with PROPERTY_HINT_NODE_PATH_VALID_TYPES "Path3D". The
  // hint filters the inspector's picker, and set_path_3d (:124) assigns any NodePath, so only the
  // literal's shape is checkable. Whether the target is a Path3D is a question about another node.
  path_3d: v.nodePath('path_3d'),

  // spline_ik_3d.cpp:84, Variant::BOOL, no hint. set_tilt_enabled (:136) assigns.
  tilt_enabled: v.boolean('tilt_enabled'),

  // spline_ik_3d.cpp:85, PROPERTY_HINT_RANGE "-1,100,1,or_greater": `or_greater` opens the max end.
  // set_tilt_fade_in (:147) assigns with no clamp, so the -1 floor warns (ADR-0032). `strictInt`,
  // because a fade size counts bones, so "2.5 bones" is malformed, not out of range.
  tilt_fade_in: v.strictInt('tilt_fade_in', { min: -1, hinted: 'spline_ik_3d.cpp:85' }),

  // spline_ik_3d.cpp:86, the same hint and the same straight-through setter
  // (:157).
  tilt_fade_out: v.strictInt('tilt_fade_out', { min: -1, hinted: 'spline_ik_3d.cpp:86' }),
};

/** Whether the key's last path segment is one of the four leaves declared here. */
function ownsLeaf(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(OWN_LEAVES, key.slice(key.lastIndexOf('/') + 1));
}

/**
 * The four own leaves and the negative-index guard. Reached only for a key whose leaf is one of the
 * four, so the `unknownCode` branch never fires: an unrecognised leaf is delegated, since a typo
 * and a ChainIK3D leaf look alike here. `INVALID_SPLINE_IK_3D_SETTING` is a code no scene produces.
 */
const ownFamily = indexedFamilyValidator({
  prefix: 'settings/',
  leaves: OWN_LEAVES,
  unknownCode: 'INVALID_SPLINE_IK_3D_SETTING',
  describes: 'SplineIK3D setting',
  // `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()`
  // (spline_ik_3d.cpp:37) and gates on nothing, so a non-numeric index resolves
  // to a setting and the write lands.
  indexParse: 'to_int',
  negativeIndex: {
    // `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)` in _set, which
    // fires on a negative index before any leaf is looked at, so the write is
    // dropped rather than applied.
    cite: 'spline_ik_3d.cpp:39',
    code: 'INVALID_SPLINE_IK_3D_SETTING_INDEX',
    message: (index) =>
      `Setting index ${index} is out of range: SplineIK3D's _set refuses a negative index (spline_ik_3d.cpp:39) and the write is dropped`,
  },
});

/**
 * Own leaves here, every other leaf to ChainIK3D. `findValidator` resolves one wildcard per key and
 * the nearest type wins, so this is the only `settings/` dispatcher a SplineIK3D reaches. Resolved
 * per call, so registration order does not matter. A leaf neither class declares returns null: a
 * base cannot close a leaf set its descendants extend.
 */
const settingsFamily: PropertyValidator = (key, value, line) => {
  if (ownsLeaf(key)) return ownFamily(key, value, line);
  const inherited = validatorRegistry.findValidator('ChainIK3D', key);
  return inherited ? inherited(key, value, line) : null;
};
// No angle brackets: the sheet generator drops this string straight into a
// Markdown table cell (lintCoverage.mjs:131), where `<i>` would open italics.
settingsFamily.accepts = "per-setting spline fitting, plus ChainIK3D's bone chain setup";
settingsFamily.grounding = ownFamily.grounding;
settingsFamily.leaves = ownFamily.leaves;

validatorRegistry.registerAll('SplineIK3D', {
  // spline_ik_3d.cpp:185, ADD_ARRAY_COUNT with PROPERTY_HINT_NONE (class_db.cpp:1492): no hint and
  // no ceiling. ChainIK3D binds no property, so each subclass declares the count
  // (iterate_ik_3d.cpp:398 too). The floor is `ERR_FAIL_COND(p_count < 0)` in `_set_setting_count`
  // (ik_modifier_3d.h:98), which set_setting_count (spline_ik_3d.h:163) calls.
  setting_count: v.strictNonNegativeInt('setting_count', { enforced: 'ik_modifier_3d.h:98' }),

  // `settings/#/*` matches a single leaf segment (`ValidatorRegistry.matchesIndexedKey`), so
  // `end_bone/direction`, `end_bone/length` and the nested `joints/<j>/` block skip this dispatcher
  // and reach ChainIK3D through the base-walk.
  'settings/#/*': settingsFamily,
});
