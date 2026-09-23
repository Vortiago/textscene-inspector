/**
 * VFlowContainer strict validators: it only takes `vertical` away. The class fixes the orientation,
 * so `set_vertical` fails `ERR_FAIL_COND_MSG(is_fixed, …)` (flow_container.cpp:372) and
 * `_validate_property` clears the key to `PROPERTY_USAGE_NONE`: Godot never writes it and rejects
 * it. The base-walk delivers the whole FlowContainer and Control set.
 */

import '../flowcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('VFlowContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain FlowContainer if the orientation must vary.`,
    cite: 'flow_container.cpp:372',
  },
});
