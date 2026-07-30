/**
 * Range strict validators for linting.
 *
 * Declare only Range's OWN members — the ones doc/classes/Range.xml
 * lists without an `overrides=` attribute. Everything from Control up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `size_flags_vertical` carries `overrides="Control"` in Range.xml — skipped,
 * Control already owns it. `ratio` appears in the XML too, but
 * `scene/gui/range.cpp`'s ADD_PROPERTY binds it `PROPERTY_HINT_RANGE, "0,1,0.01",
 * PROPERTY_USAGE_NONE` — the USAGE_NONE flag means Godot never serializes it to
 * a .tscn, so it gets no validator either.
 *
 * None of the remaining nine carries a `PROPERTY_HINT_RANGE` in the .cpp (only
 * `ratio` does), so every one of them is format-only: any finite float, or a
 * plain boolean literal. Godot's own setters (`set_min`/`set_max`/`set_page`)
 * clamp out-of-order or out-of-bounds combinations at runtime rather than
 * rejecting them — see linter.ts for the one case worth an advisory warning.
 */

import '../../../2d/ui/control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('Range', {
  // scene/gui/range.cpp:405 — ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "min_value"), "set_min", "get_min");
  min_value: v.float('min_value'),
  // scene/gui/range.cpp:406 — ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "max_value"), "set_max", "get_max");
  max_value: v.float('max_value'),
  // scene/gui/range.cpp:407 — ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "step"), "set_step", "get_step");
  step: v.float('step'),
  // scene/gui/range.cpp:408 — ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "page"), "set_page", "get_page");
  page: v.float('page'),
  // scene/gui/range.cpp:409 — ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "value"), "set_value", "get_value");
  value: v.float('value'),
  // scene/gui/range.cpp:411 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "exp_edit"), "set_exp_ratio", "is_ratio_exp");
  exp_edit: v.boolean('exp_edit'),
  // scene/gui/range.cpp:412 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "rounded"), "set_use_rounded_values", "is_using_rounded_values");
  rounded: v.boolean('rounded'),
  // scene/gui/range.cpp:413 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_greater"), "set_allow_greater", "is_greater_allowed");
  allow_greater: v.boolean('allow_greater'),
  // scene/gui/range.cpp:414 — ADD_PROPERTY(PropertyInfo(Variant::BOOL, "allow_lesser"), "set_allow_lesser", "is_lesser_allowed");
  allow_lesser: v.boolean('allow_lesser'),
});
