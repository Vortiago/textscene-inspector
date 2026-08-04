/**
 * Validators shared by every ScrollBar-derived node.
 *
 * Registered under the abstract key 'ScrollBar', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 2 subclasses through the NODE_BASE_TYPES base-walk.
 *
 * doc/classes/ScrollBar.xml lists three members. `focus_mode`
 * (overrides="Control") and `step` (overrides="Range") are documentation of a
 * changed constructor default only: ScrollBar::_bind_methods (scroll_bar.cpp:678-698)
 * calls ADD_PROPERTY exactly once, for `custom_step`, so those two are skipped
 * per the "overrides= is a default override" rule and stay validated where
 * they are actually bound (Control, Range). `custom_step` is ScrollBar's one
 * own member.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ScrollBar', {
  // scroll_bar.cpp:684: ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "custom_step",
  // PROPERTY_HINT_RANGE, "-1,4096,suffix:px"), ...). Neither end is softened by
  // or_greater/or_less, so both are hard hint bounds. set_custom_step
  // (scroll_bar.cpp:562-564) assigns unconditionally, no ERR_FAIL or clamp, so
  // out of range is a warning rather than an error.
  custom_step: v.float('custom_step', { min: -1, max: 4096, hinted: 'scroll_bar.cpp:684' }),
});
