/**
 * BoneAttachment3D strict validators for linting.
 *
 * Declare only BoneAttachment3D's OWN members, the ones doc/classes/BoneAttachment3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('BoneAttachment3D', {
  // bone_attachment_3d.cpp:376, declared Variant::STRING_NAME with no hint, but
  // `get_bone_name` returns `String` (cpp:186), so Godot saves the plain quoted
  // form; the variant parser reads `&"…"` too. set_bone_name (cpp:178-184)
  // assigns before it looks a skeleton up, so no name is refused.
  bone_name: v.stringName('bone_name'),
  // bone_attachment_3d.cpp:377, Variant::INT, PROPERTY_HINT_NONE, so no hinted
  // range either. Format only: set_bone_idx (cpp:190-214) carries no ERR_FAIL
  // and no unconditional clamp. Its single guard, `bone_idx <= -1 || bone_idx
  // >= sk->get_bone_count()` (cpp:199), runs only when a live Skeleton3D
  // resolves, its ceiling is that skeleton's bone count, and its floor swallows
  // -1, the documented default, and what `_check_bind` (cpp:117) treats as
  // "unset, resolve from bone_name". Neither end is statically checkable.
  // `strictInt`, not `int`: a bone index is discrete, and `v.int` would read
  // `2.5` as 2 instead of reporting it.
  // The setter assigns, then (when a Skeleton3D has resolved) rewrites anything
  // `<= -1` or past the bone count back to -1. So -2 is ALTERED, which is the
  // enforced tier, while -1 itself is a no-op and must stay legal: it is the
  // documented unset default, and a floor of 0 would reject what Godot writes.
  // The ceiling is the live bone count, which no per-property validator sees.
  bone_idx: v.strictInt('bone_idx', { min: -1, enforced: 'bone_attachment_3d.cpp:201' }),
  // bone_attachment_3d.cpp:378, plain Variant::BOOL. set_override_pose
  // (cpp:220-236) assigns past an equality guard and then only reconfigures
  // notifications, so nothing beyond the literal's shape is checkable.
  override_pose: v.boolean('override_pose'),
  // bone_attachment_3d.cpp:379, plain Variant::BOOL. set_use_external_skeleton
  // (cpp:242-253) assigns unconditionally and re-resolves the cache.
  use_external_skeleton: v.boolean('use_external_skeleton'),
  // bone_attachment_3d.cpp:380, Variant::NODE_PATH with
  // PROPERTY_HINT_NODE_PATH_VALID_TYPES "Skeleton3D", a filter on the
  // inspector's node picker, not on the stored value, and
  // set_external_skeleton (cpp:259-263) is a bare assignment.
  //
  // It DOES get a validator despite `_validate_property` (cpp:55-57) forcing
  // PROPERTY_USAGE_NONE on it: that branch is conditional on
  // `!use_external_skeleton`, so with the flag on the property serialises
  // normally. Do not delete this as a never-stored key.
  external_skeleton: v.nodePath('external_skeleton'),
});
