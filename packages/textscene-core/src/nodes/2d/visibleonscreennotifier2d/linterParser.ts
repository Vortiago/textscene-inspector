/**
 * VisibleOnScreenNotifier2D strict validators: only its own members, the ones
 * doc/classes/VisibleOnScreenNotifier2D.xml lists without an `overrides=` attribute. The
 * NODE_BASE_TYPES base-walk delivers everything from Node2D up, so re-declaring an inherited key
 * shadows it and duplicates the rule.
 */

import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('VisibleOnScreenNotifier2D', {
  // scene/2d/visible_on_screen_notifier_2d.cpp: ADD_PROPERTY(PropertyInfo(Variant::RECT2,
  // "rect", PROPERTY_HINT_NONE, "suffix:px"), ...): no range hint, only the Rect2(...) shape.
  rect: v.rect2('rect'),

  // scene/2d/visible_on_screen_notifier_2d.cpp: ADD_PROPERTY(PropertyInfo(Variant::BOOL,
  // "show_rect"), ...): a plain BOOL, no range to check.
  show_rect: v.boolean('show_rect'),
});
