/**
 * XRNode3D strict validators for its own members, the ones doc/classes/XRNode3D.xml lists
 * without `overrides=`. Keys from Node3D up arrive through the NODE_BASE_TYPES base-walk, so
 * re-declaring one would shadow the ancestor's rule.
 */

// The base chain. Registration happens on import, so a test that loads only this slice resolves an
// inherited key only if this line pulls in the ancestor.
import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// scene/3d/xr/xr_nodes.h: get_tracker()/get_pose_name() both return StringName, so Godot serialises
// them `&"..."`. The variant text parser also accepts a plain `"..."` literal, which the setter casts
// to StringName.

validatorRegistry.registerAll('XRNode3D', {
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "pose", ...))
  pose: v.stringName('pose'),
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "tracker", ...))
  tracker: v.stringName('tracker'),
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "show_when_tracked"), ...)
  show_when_tracked: v.boolean('show_when_tracked'),
});
