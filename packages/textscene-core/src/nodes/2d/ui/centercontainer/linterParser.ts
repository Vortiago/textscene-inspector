/**
 * CenterContainer strict validators. `use_top_left` (doc/classes/CenterContainer.xml) is the whole
 * own surface: `Container::_bind_methods` (container.cpp:217) binds no ADD_PROPERTY, and neither
 * scene/gui/center_container.h nor scene/gui/container.cpp overrides the property list, `_set`,
 * `_get` or `_validate_property`. Everything else arrives through the NODE_BASE_TYPES walk.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CenterContainer', {
  // center_container.cpp:94, a BOOL with no hint. set_use_top_left (center_container.cpp:50-58)
  // assigns past its equality guard with no ERR_FAIL or clamp, so only the literal is checked.
  use_top_left: v.boolean('use_top_left'),
});
