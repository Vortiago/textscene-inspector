/**
 * ModifierBoneTarget3D strict validators: only the members doc/classes/ModifierBoneTarget3D.xml lists
 * without `overrides=`. The two keys need no cross-field rule: `_validate_bone_names`
 * (modifier_bone_target_3d.cpp:33-40) recomputes `bone` from a non-empty `bone_name`, and Godot's
 * saver keeps both consistent, so a pair rule would fire on valid scenes.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ModifierBoneTarget3D', {
  // modifier_bone_target_3d.cpp:96, STRING with PROPERTY_HINT_ENUM_SUGGESTION over the bone names, a
  // suggestion, not a constraint. set_bone_name (:42-48) assigns before resolving, so no value is
  // refused: format only.
  bone_name: v.quotedString('bone_name'),

  // modifier_bone_target_3d.cpp:97, INT, PROPERTY_HINT_NONE, PROPERTY_USAGE_NO_EDITOR, which is
  // STORAGE (object.h:132). -1 is the unset default (modifier_bone_target_3d.h:39). set_bone (:58-60)
  // alters anything below it to -1 inside `if (sk)`, and _validate_bone_names re-runs it from
  // skeleton_modifier_3d.cpp:68. The live bone count is the ceiling. `strictInt`: Variant truncates.
  bone: v.strictInt('bone', { min: -1, enforced: 'modifier_bone_target_3d.cpp:58-60' }),
});
