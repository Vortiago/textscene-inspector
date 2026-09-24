/**
 * VBoxContainer strict validators: it only takes `vertical` away. The class fixes the orientation,
 * so `set_vertical` fails `ERR_FAIL_COND_MSG(is_fixed, …)` (scene/gui/box_container.cpp:312) and
 * `_validate_property` clears the key to `PROPERTY_USAGE_NONE`: Godot never writes it and rejects
 * it. The base-walk delivers the whole BoxContainer and Control set.
 */

import '../boxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('VBoxContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain BoxContainer if the orientation must vary.`,
    cite: 'box_container.cpp:312',
  },
});
