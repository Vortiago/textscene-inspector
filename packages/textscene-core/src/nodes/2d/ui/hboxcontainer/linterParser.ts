/**
 * HBoxContainer strict validators: it declares nothing and removes BoxContainer's
 * `vertical`. `set_vertical` refuses it (`ERR_FAIL_COND_MSG(is_fixed, …)`,
 * scene/gui/box_container.cpp:312) and `_validate_property`
 * hides it, so Godot never writes it. The NODE_BASE_TYPES walk delivers the rest.
 */

import '../boxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';

validatorRegistry.registerUnavailable('HBoxContainer', {
  vertical: {
    reason: `its orientation is fixed by the class. Use a plain BoxContainer if the orientation must vary.`,
    cite: 'box_container.cpp:312',
  },
});
