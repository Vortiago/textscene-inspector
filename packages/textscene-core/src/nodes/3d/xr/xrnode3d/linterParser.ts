/**
 * XRNode3D strict validators for linting.
 *
 * Declare only XRNode3D's OWN members — the ones doc/classes/XRNode3D.xml
 * lists without an `overrides=` attribute. Everything from Node3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 */

import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// scene/3d/xr/xr_nodes.h: get_tracker()/get_pose_name() both return StringName,
// so Godot always serialises them `&"..."` — but the variant text parser also
// accepts a plain `"..."` literal (implicit StringName cast on the setter),
// same leniency as Window's theme_type_variation and the shared audio busValidator.

validatorRegistry.registerAll('XRNode3D', {
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "pose", ...))
  pose: v.stringName('pose'),
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::STRING, "tracker", ...))
  tracker: v.stringName('tracker'),
  // scene/3d/xr/xr_nodes.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "show_when_tracked"), ...)
  show_when_tracked: v.boolean('show_when_tracked'),
});
