/**
 * VFlowContainer strict validators.
 *
 * It declares nothing. Its only relationship to the property set it inherits is
 * subtractive: `vertical` comes from FlowContainer, and this class fixes the
 * orientation, so `set_vertical` is
 * `ERR_FAIL_COND_MSG(is_fixed, "Can't change orientation of …")`
 * (flow_container.cpp:372) and `_validate_property` clears the key to
 * `PROPERTY_USAGE_NONE`. A scene carrying it is one Godot could not have
 * written and would reject.
 *
 * Everything else, the whole FlowContainer and Control set, arrives through the
 * NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../flowcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('VFlowContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain FlowContainer if the orientation must vary.`,
    cite: 'flow_container.cpp:372',
  },
});
