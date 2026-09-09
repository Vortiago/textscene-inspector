/**
 * HBoxContainer strict validators.
 *
 * It declares nothing. Its only relationship to the property set it inherits is
 * subtractive: `vertical` comes from BoxContainer, and this class fixes the
 * orientation, so `set_vertical` is
 * `ERR_FAIL_COND_MSG(is_fixed, "Can't change orientation of …")`
 * (scene/gui/box_container.cpp:312) and `_validate_property` clears the key to
 * `PROPERTY_USAGE_NONE`. A scene carrying it is one Godot could not have
 * written and would reject.
 *
 * Everything else, the whole BoxContainer and Control set, arrives through the
 * NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../boxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('HBoxContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain BoxContainer if the orientation must vary.`,
    cite: 'box_container.cpp:312',
  },
});
