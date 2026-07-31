/**
 * HSplitContainer strict validators.
 *
 * It declares nothing. Its only relationship to the property set it inherits is
 * subtractive: `vertical` comes from SplitContainer, and this class fixes the
 * orientation, so `set_vertical` is
 * `ERR_FAIL_COND_MSG(is_fixed, "Can't change orientation of …")`
 * (scene/gui/split_container.cpp:1120) and `_validate_property` clears the key to
 * `PROPERTY_USAGE_NONE`. A scene carrying it is one Godot could not have
 * written and would reject.
 *
 * Everything else, the whole SplitContainer and Control set, arrives through the
 * NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../splitcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('HSplitContainer', {
  vertical: `its orientation is fixed by the class. Use a plain SplitContainer if the orientation must vary.`,
});
