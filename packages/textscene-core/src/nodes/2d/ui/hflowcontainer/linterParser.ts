/**
 * HFlowContainer strict validators: doc/classes/HFlowContainer.xml has no members,
 * and FlowContainer's `vertical` is removed. `set_vertical` refuses it with
 * `ERR_FAIL_COND_MSG(is_fixed, …)` (flow_container.cpp:372) and `_validate_property`
 * hides it, so Godot never writes it. The NODE_BASE_TYPES walk delivers the rest.
 */

import '../flowcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('HFlowContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain FlowContainer if the orientation must vary.`,
    cite: 'flow_container.cpp:372',
  },
});
