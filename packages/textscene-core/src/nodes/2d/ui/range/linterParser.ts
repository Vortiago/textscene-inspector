/**
 * Range's strict validators: the members doc/classes/Range.xml lists without
 * `overrides=`. Range.xml lists `ratio`, but `scene/gui/range.cpp` binds it
 * `PROPERTY_USAGE_NONE`, so it is never serialised. No other member has a
 * hint, and `linter.ts` holds the cross-field rules.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// Inherited keys arrive through the NODE_BASE_TYPES base-walk. Re-declaring one
// shadows it and duplicates the rule.
validatorRegistry.registerAll('Range', {
  // scene/gui/range.cpp:405: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "min_value"), "set_min", "get_min");
  min_value: v.float('min_value'),
  // scene/gui/range.cpp:406: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "max_value"), "set_max", "get_max");
  max_value: v.float('max_value'),
  // scene/gui/range.cpp:407: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "step"), "set_step", "get_step");
  step: v.float('step'),
  // scene/gui/range.cpp:408: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "page"), "set_page", "get_page");
  // range.cpp:255 clamps the page into [0, max - min], and set_min/set_max keep
  // `max >= min` (range.cpp:217/:229), so the low end is 0. The end is the
  // setter's: range.cpp:408 declares no hint.
  page: v.float('page', { enforcedMin: { at: 0 }, enforced: { min: 'range.cpp:255' } }),
  // scene/gui/range.cpp:409: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "value"), "set_value", "get_value");
  value: v.float('value'),
  // scene/gui/range.cpp:411: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "exp_edit"), "set_exp_ratio", "is_ratio_exp");
  exp_edit: v.boolean('exp_edit'),
  // scene/gui/range.cpp:412: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "rounded"), "set_use_rounded_values", "is_using_rounded_values");
  rounded: v.boolean('rounded'),
  // scene/gui/range.cpp:413: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_greater"), "set_allow_greater", "is_greater_allowed");
  allow_greater: v.boolean('allow_greater'),
  // scene/gui/range.cpp:414: ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_lesser"), "set_allow_lesser", "is_lesser_allowed");
  allow_lesser: v.boolean('allow_lesser'),
});
