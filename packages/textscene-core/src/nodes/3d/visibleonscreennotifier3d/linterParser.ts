/**
 * VisibleOnScreenNotifier3D strict validators for linting.
 *
 * Declare only VisibleOnScreenNotifier3D's OWN members — the ones doc/classes/VisibleOnScreenNotifier3D.xml
 * lists without an `overrides=` attribute. VisibleOnScreenNotifier3D chains to
 * VisualInstance3D (not directly to Node3D), so it inherits `layers` from there
 * and the Node3D transform set from underneath it, both delivered by the
 * NODE_BASE_TYPES base-walk — re-declaring either here would shadow the
 * ancestor's rule and duplicate it.
 */

import '../visualinstance3d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VisibleOnScreenNotifier3D', {
  // scene/3d/visible_on_screen_notifier_3d.cpp: ADD_PROPERTY(PropertyInfo(Variant::AABB,
  // "aabb", PROPERTY_HINT_NONE, "suffix:m"), ...) — no range hint, just the AABB(...) shape.
  aabb: v.aabb('aabb'),
});
