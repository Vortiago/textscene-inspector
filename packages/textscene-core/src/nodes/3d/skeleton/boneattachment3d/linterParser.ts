/**
 * BoneAttachment3D strict validators: only its own members, which doc/classes/BoneAttachment3D.xml
 * lists without `overrides=`. The NODE_BASE_TYPES base-walk delivers Node3D and up, and a
 * re-declared inherited key shadows it.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('BoneAttachment3D', {
  // bone_attachment_3d.cpp:376, declared Variant::STRING_NAME with no hint, but
  // `get_bone_name` returns `String` (cpp:186), so Godot saves the plain quoted
  // form, and the variant parser reads `&"…"` too. set_bone_name (cpp:178-184)
  // assigns before it looks a skeleton up, so no name is refused.
  bone_name: v.stringName('bone_name'),
  // bone_attachment_3d.cpp:377, INT, no hint. `strictInt`: `v.int` reads `2.5` as 2. -1 is the
  // default, which `_check_bind` (cpp:117) reads as "unset, resolve from bone_name", so it stays
  // legal. The ceiling is the live bone count, which no per-property validator sees.
  // `boneAttachment3D.md` says why the cite is `_check_bind`, not the setter.
  bone_idx: v.strictInt('bone_idx', { min: -1, enforced: 'bone_attachment_3d.cpp:117-118' }),
  // bone_attachment_3d.cpp:378, plain Variant::BOOL. set_override_pose
  // (cpp:220-236) assigns past an equality guard and then only reconfigures
  // notifications, so nothing beyond the literal's shape is checkable.
  override_pose: v.boolean('override_pose'),
  // bone_attachment_3d.cpp:379, plain Variant::BOOL. set_use_external_skeleton
  // (cpp:242-253) assigns unconditionally and re-resolves the cache.
  use_external_skeleton: v.boolean('use_external_skeleton'),
  // bone_attachment_3d.cpp:380, NODE_PATH with PROPERTY_HINT_NODE_PATH_VALID_TYPES "Skeleton3D", a
  // filter on the node picker, and set_external_skeleton (cpp:259-263) is a bare assignment.
  // `_validate_property` (cpp:55-57) forces PROPERTY_USAGE_NONE only while `!use_external_skeleton`,
  // so with the flag on the key serialises and needs this validator.
  external_skeleton: v.nodePath('external_skeleton'),
});
