/**
 * VSplitContainer strict validators: it only takes back the inherited `vertical`. The class
 * fixes the orientation, so `set_vertical` refuses it with `ERR_FAIL_COND_MSG(is_fixed, …)`
 * (scene/gui/split_container.cpp:1120) and `_validate_property` clears the
 * key to `PROPERTY_USAGE_NONE`. The rest arrives through the NODE_BASE_TYPES base-walk.
 */

import '../splitcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

// A scene carrying `vertical` is one Godot could not have written and would reject.
validatorRegistry.registerUnavailable('VSplitContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain SplitContainer if the orientation must vary.`,
    cite: 'split_container.cpp:1120',
  },
});
