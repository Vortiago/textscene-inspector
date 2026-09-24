/**
 * Validators shared by every ScrollBar-derived node, under the abstract key
 * 'ScrollBar' that the NODE_BASE_TYPES base-walk hands to its subclasses.
 * doc/classes/ScrollBar.xml's `focus_mode` and `step` are `overrides=`, and
 * ScrollBar::_bind_methods (scroll_bar.cpp:678-698) binds only `custom_step`.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('ScrollBar', {
  // scroll_bar.cpp:684 hints PROPERTY_HINT_RANGE "-1,4096,suffix:px" with both
  // ends closed. set_custom_step (scroll_bar.cpp:562-564) assigns
  // unconditionally, so out of range is a warning.
  custom_step: v.float('custom_step', { min: -1, max: 4096, hinted: 'scroll_bar.cpp:684' }),
});
