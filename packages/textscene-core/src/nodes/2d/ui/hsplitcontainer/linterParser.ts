/**
 * HSplitContainer strict validators: it declares nothing and removes
 * SplitContainer's `vertical`. `set_vertical` refuses it (`ERR_FAIL_COND_MSG(is_fixed, …)`,
 * scene/gui/split_container.cpp:1120) and `_validate_property` hides it, so Godot
 * never writes it. The NODE_BASE_TYPES walk delivers the rest.
 */

import '../splitcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('HSplitContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain SplitContainer if the orientation must vary.`,
    cite: 'split_container.cpp:1120',
  },
});
