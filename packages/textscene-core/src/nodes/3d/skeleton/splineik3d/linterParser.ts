/**
 * SplineIK3D strict validators for linting.
 *
 * Declare only SplineIK3D's OWN members, the ones doc/classes/SplineIK3D.xml
 * lists without an `overrides=` attribute. Everything from ChainIK3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * ## The XML member list is one line long and the surface is not
 *
 * SplineIK3D.xml lists `setting_count` alone, and `_bind_methods` has a single
 * `ADD_ARRAY_COUNT` (spline_ik_3d.cpp:185) to match. The rest of the class's
 * serialised surface is four leaves added BY HAND to the `settings/<i>/` family
 * ChainIK3D already owns: `_set` (spline_ik_3d.cpp:33) and `_get` (:56) parse
 * the path, and `_get_property_list` (:79) emits them as
 * `"settings/" + itos(i) + "/"` (:82) before chaining to
 * `ChainIK3D::get_property_list` (:94).
 *
 * `setting_count` IS this class's, not the base's: ChainIK3D binds no property
 * at all, and each concrete subclass declares the array count itself
 * (spline_ik_3d.cpp:185, iterate_ik_3d.cpp:398). The floor it enforces lives in
 * the base template `_set_setting_count` (ik_modifier_3d.h:98), which is where
 * the citation points.
 *
 * ## The dispatcher delegates instead of closing the family
 *
 * `findValidator` resolves ONE wildcard per key and the nearest type wins
 * outright, so a `settings/` dispatcher registered here is the ONLY one a
 * SplineIK3D node ever reaches for a flat `settings/<i>/<leaf>` key. Answering
 * for the four leaves alone would make every inherited one (`root_bone`,
 * `extend_end_bone`, `joint_count`) read as unvalidated or unknown. Own leaves
 * resolve here; every other leaf is handed to the ChainIK3D registration, which
 * is what the base-walk would have done had this slice registered nothing.
 *
 * The two-segment leaves (`end_bone/direction`, `end_bone/length`) and the
 * nested `joints/<j>/` block never reach this dispatcher at all: the glued-index
 * pattern `settings/#/*` matches a SINGLE leaf segment only
 * (`ValidatorRegistry.matchesIndexedKey`), so the base-walk delivers them to
 * ChainIK3D directly.
 *
 * None of the four leaves is an angle, so no `radians_as_degrees` hint applies
 * and no degree-to-radian conversion is involved anywhere in this file.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/v.js';
import '../chainik3d/linterParser.js';

/**
 * The four leaves SplineIK3D adds to the inherited `settings/<i>/` family,
 * keyed exactly as `_get_property_list` spells them (spline_ik_3d.cpp:83-86).
 */
const OWN_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // spline_ik_3d.cpp:83, Variant::NODE_PATH with PROPERTY_HINT_NODE_PATH_VALID_
  // TYPES "Path3D". The hint filters the inspector's node picker; whether the
  // target is a Path3D is a question about another node, not about this value,
  // and set_path_3d (:124) assigns whatever NodePath it is given. Only the
  // literal's shape is checkable here.
  path_3d: v.nodePath('path_3d'),

  // spline_ik_3d.cpp:84, Variant::BOOL, no hint. set_tilt_enabled (:136) assigns.
  tilt_enabled: v.boolean('tilt_enabled'),

  // spline_ik_3d.cpp:85, PROPERTY_HINT_RANGE "-1,100,1,or_greater". `or_greater`
  // opens the max end, so only the -1 floor is reportable, and set_tilt_fade_in
  // (:147) assigns straight through with no clamp: the hint governs the
  // inspector spinner alone, which makes it a warning (ADR-0032). `strictInt`,
  // because a fade size counts bones and "2.5 bones" is a malformed value
  // rather than an out-of-range one.
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
 * The four own leaves and the negative-index guard.
 *
 * Reached only for a key whose leaf is one of the four, so its `unknownCode`
 * branch never fires: an unrecognised leaf is delegated below rather than
 * rejected, since the dispatcher cannot tell a typo from a leaf ChainIK3D
 * validates and accepts. `INVALID_SPLINE_IK_3D_SETTING` is therefore a code no
 * scene can produce, and the closure `indexedFamilyValidator` normally supplies
 * is deliberately not in force here.
 */
const ownFamily = indexedFamilyValidator({
  prefix: 'settings/',
  leaves: OWN_LEAVES,
  unknownCode: 'INVALID_SPLINE_IK_3D_SETTING',
  describes: 'SplineIK3D setting',
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
 * Own leaves here, every other leaf to ChainIK3D.
 *
 * Resolved through the registry on each call rather than captured at module
 * load, so the delegation is unaffected by which of the two registrations runs
 * first. A leaf neither class declares returns null, matching the base's own
 * choice to leave the family open (a base cannot close a leaf set its
 * descendants extend, and this class extends it).
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
  // spline_ik_3d.cpp:185, ADD_ARRAY_COUNT, whose PropertyInfo carries
  // PROPERTY_HINT_NONE (class_db.cpp:1492), so there is no hint to fall back
  // on and no ceiling anywhere. The floor is the setter's: SplineIK3D::
  // set_setting_count (spline_ik_3d.h:163) forwards to the base template
  // _set_setting_count, which opens `ERR_FAIL_COND(p_count < 0)`
  // (ik_modifier_3d.h:98) and refuses the write outright.
  setting_count: v.strictNonNegativeInt('setting_count', { enforced: 'ik_modifier_3d.h:98' }),

  'settings/#/*': settingsFamily,
});
