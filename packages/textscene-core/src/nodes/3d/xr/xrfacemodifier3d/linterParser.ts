/**
 * XRFaceModifier3D strict validators for its own members, the ones doc/classes/XRFaceModifier3D.xml lists
 * without `overrides=`. Keys from Node3D up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

// Both ADD_PROPERTY calls sit in `_bind_methods` (xr_face_modifier_3d.cpp:495-503),
// each with a non-empty setter and getter. xr_face_modifier_3d.h declares no
// `_set`/`_get`/`get_property_list` override under either spelling and no
// `ADD_ARRAY_COUNT`, so ADD_PROPERTY is the only route a member takes here.

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('XRFaceModifier3D', {
  // xr_face_modifier_3d.cpp:498, Variant::STRING with PROPERTY_HINT_ENUM_SUGGESTION
  // "/user/face_tracker", a picker default. get_face_tracker returns `StringName` (cpp:505-515), so
  // Godot saves the &"…" spelling: the getter's type decides the serialised form. set_face_tracker
  // assigns straight through, so there is no bound.
  face_tracker: v.stringName('face_tracker'),
  // xr_face_modifier_3d.cpp:502, PROPERTY_HINT_NODE_PATH_VALID_TYPES
  // "MeshInstance3D", a filter on the inspector's node picker, not on the
  // stored value. set_target (cpp:517-523) is a bare assignment.
  target: v.nodePath('target'),
});
