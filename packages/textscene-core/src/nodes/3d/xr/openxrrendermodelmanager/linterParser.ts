/**
 * OpenXRRenderModelManager strict validators for linting.
 *
 * Declare only OpenXRRenderModelManager's OWN members — the ones doc/classes/OpenXRRenderModelManager.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * Both ADD_PROPERTY calls sit in `_bind_methods`
 * (openxr_render_model_manager.cpp:41-57), each with a non-empty setter and
 * getter. openxr_render_model_manager.h declares no `_set`/`_get`/
 * `get_property_list` override under either spelling and no
 * `ADD_ARRAY_COUNT`, so ADD_PROPERTY is the only route a member takes here.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('OpenXRRenderModelManager', {
  // openxr_render_model_manager.cpp:44, PROPERTY_HINT_ENUM "Any,None set,Left
  // Hand,Right Hand". set_tracker (cpp:228-266) assigns `tracker = p_tracker`
  // UNCONDITIONALLY on the very first line, before any check — the only guard,
  // `ERR_FAIL_MSG("Unsupported tracker value set.")` at cpp:248, sits inside an
  // `else` branch reached solely at runtime (`!is_editor_hint()`) for values
  // that are neither ANY/NONE_SET nor LEFT_HAND/RIGHT_HAND, and even then it
  // does not revert the assignment already made. So an out-of-range value is
  // kept, not refused: the ENUM hint constrains the inspector's dropdown, not
  // the engine, which is the hinted (warning) tier.
  tracker: v.enumInt(
    'tracker',
    0,
    3,
    { 0: 'Any', 1: 'None set', 2: 'Left Hand', 3: 'Right Hand' },
    { hinted: 'openxr_render_model_manager.cpp:44' }
  ),
  // openxr_render_model_manager.cpp:48, declared Variant::STRING with
  // PROPERTY_HINT_ENUM_SUGGESTION "aim,grip" (a picker default, not a format
  // or enum — any string is legal). set_make_local_to_pose (cpp:272-282)
  // assigns straight through with no validation. Godot's writer always
  // quotes a plain STRING, so `v.quotedString` (not `v.string`, which does
  // not check for quoting) is the real grammar here.
  make_local_to_pose: v.quotedString('make_local_to_pose'),
});
