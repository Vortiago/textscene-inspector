/**
 * VisibleOnScreenNotifier3D strict validators for its own members, the ones
 * doc/classes/VisibleOnScreenNotifier3D.xml lists without `overrides=`. It inherits `layers` from
 * VisualInstance3D and the Node3D transform set through the NODE_BASE_TYPES base-walk, so
 * re-declaring either would shadow the ancestor's rule.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VisibleOnScreenNotifier3D', {
  // scene/3d/visible_on_screen_notifier_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::AABB,
  // "aabb", PROPERTY_HINT_NONE, "suffix:m"), ...): no range hint, only the AABB(...) shape.
  aabb: v.aabb('aabb'),
});
