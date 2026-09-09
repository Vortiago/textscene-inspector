/**
 * CenterContainer strict validators for linting.
 *
 * Checked against Godot 4.6.3: doc/classes/CenterContainer.xml (one member,
 * `use_top_left`, no `overrides=` attribute) and scene/gui/center_container.h /
 * .cpp, plus scene/gui/container.cpp to confirm the Container base
 * (`Container::_bind_methods`, container.cpp:217) binds no ADD_PROPERTY of its
 * own — layout behaviour only, driven entirely by Control keys. Neither file
 * overrides `_get_property_list`/`_set`/`_get`/`_validate_property`, so
 * `use_top_left` is the entire own surface; everything else reaches this type
 * through the NODE_BASE_TYPES base-walk from Control/CanvasItem/Node.
 *
 * `use_top_left` (center_container.cpp:94 —
 * `ADD_PROPERTY(PropertyInfo(Variant::BOOL, "use_top_left"), ...)`, no hint)
 * is a plain flag: `set_use_top_left` (center_container.cpp:50-58) assigns
 * straight through once past its no-op equality guard — no ERR_FAIL, no
 * clamp, no hinted range — so nothing beyond "is this a boolean literal"
 * needs checking.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('CenterContainer', {
  use_top_left: v.boolean('use_top_left'),
});
