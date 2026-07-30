/**
 * VSplitContainer strict validators.
 *
 * It declares one key of its own, and only to take something AWAY: `vertical`
 * is inherited from SplitContainer but this class fixes the orientation, so Godot
 * refuses the assignment. See ../shared/fixedOrientation.ts.
 *
 * Everything else — the whole SplitContainer and Control set — arrives through
 * the NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../splitcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { fixedOrientation } from '../shared/fixedOrientation.js';

validatorRegistry.registerAll('VSplitContainer', {
  vertical: fixedOrientation('VSplitContainer'),
});
