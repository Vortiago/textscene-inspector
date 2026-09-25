/**
 * OpenXRRenderModelManager strict validators for its own members, the ones
 * doc/classes/OpenXRRenderModelManager.xml lists without `overrides=`. Keys from Node3D up arrive
 * through the NODE_BASE_TYPES base-walk, so re-declaring one would shadow the ancestor's rule.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Both ADD_PROPERTY calls sit in `_bind_methods` (openxr_render_model_manager.cpp:41-57), each with
// a non-empty setter and getter. openxr_render_model_manager.h declares no `_set`/`_get`/
// `get_property_list` override in either spelling and no `ADD_ARRAY_COUNT`, so ADD_PROPERTY is the
// only route a member takes here.
validatorRegistry.registerAll('OpenXRRenderModelManager', {
  // openxr_render_model_manager.cpp:44, PROPERTY_HINT_ENUM "Any,None set,Left Hand,Right Hand".
  // set_tracker (cpp:228-266) assigns `tracker = p_tracker` before any check. Its only guard, the
  // `ERR_FAIL_MSG` at cpp:248, runs only at runtime (`!is_editor_hint()`) and does not revert the
  // assignment, so an out-of-range value is kept and the hint tier warns.
  tracker: v.enumInt(
    'tracker',
    0,
    3,
    { 0: 'Any', 1: 'None set', 2: 'Left Hand', 3: 'Right Hand' },
    { hinted: 'openxr_render_model_manager.cpp:44' }
  ),
  // openxr_render_model_manager.cpp:48, Variant::STRING with PROPERTY_HINT_ENUM_SUGGESTION
  // "aim,grip", so any string is legal. set_make_local_to_pose (cpp:272-282) does no validation.
  // Godot always quotes a plain STRING, so the grammar is `v.quotedString`, not `v.string`, which
  // does not check the quotes.
  make_local_to_pose: v.quotedString('make_local_to_pose'),
});
