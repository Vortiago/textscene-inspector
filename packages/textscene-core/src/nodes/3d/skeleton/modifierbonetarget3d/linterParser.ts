/**
 * ModifierBoneTarget3D strict validators for linting.
 *
 * Declare only ModifierBoneTarget3D's OWN members, the ones doc/classes/ModifierBoneTarget3D.xml
 * lists without an `overrides=` attribute. Everything from SkeletonModifier3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * The two keys look like a cross-field rule and are not one. `_validate_bone_names`
 * (modifier_bone_target_3d.cpp:33-40) prefers a non-empty `bone_name` and recomputes
 * `bone` from `find_bone`, so the serialised `bone` is discarded whenever `bone_name`
 * is set. Godot's saver writes both and keeps them consistent by construction, both
 * setters deriving one from the other, so a rule reporting the pair would fire on
 * every valid scene, and whether they actually agree depends on the live Skeleton3D.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ModifierBoneTarget3D', {
  // modifier_bone_target_3d.cpp:96, Variant::STRING with
  // PROPERTY_HINT_ENUM_SUGGESTION over the skeleton's concatenated bone names.
  // A suggestion list is not a constraint even in the inspector, and
  // set_bone_name (:42-48) assigns the string unconditionally before trying to
  // resolve it, so no value is refused: format only, no grounding to cite.
  bone_name: v.quotedString('bone_name'),

  // modifier_bone_target_3d.cpp:97, Variant::INT, PROPERTY_HINT_NONE, and
  // PROPERTY_USAGE_NO_EDITOR, which IS storage (object.h:132 defines it as
  // PROPERTY_USAGE_STORAGE), so this key really is written to the `.tscn`.
  //
  // -1 is the class's own unset sentinel (modifier_bone_target_3d.h:39) and the
  // value set_bone writes back, so it is legal and a floor of 0 would reject
  // what Godot serialises. Below it, set_bone (:58-60) ALTERS the write to -1;
  // the WARN_PRINT beside it is only noise, the assignment is the enforcement.
  // The ceiling is `sk->get_bone_count()` on the parent Skeleton3D, a live-tree
  // quantity no per-property validator can see, so the max end stays open.
  //
  // The clamp is guarded by `if (sk)`, so it does not run while the skeleton is
  // still unresolved at load; _validate_bone_names (:33-40) re-runs the same
  // setter from skeleton_modifier_3d.cpp:68 once one is, so a value under -1
  // cannot survive as written. `strictInt`, because a bone index is discrete
  // and Godot's Variant conversion truncates a decimal rather than keeping it.
  bone: v.strictInt('bone', { min: -1, enforced: 'modifier_bone_target_3d.cpp:58-60' }),
});
