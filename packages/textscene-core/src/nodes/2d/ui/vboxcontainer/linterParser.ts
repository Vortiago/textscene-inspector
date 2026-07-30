/**
 * VBoxContainer strict validators.
 *
 * It declares one key of its own, and only to take something AWAY: `vertical`
 * is inherited from BoxContainer but this class fixes the orientation, so Godot
 * refuses the assignment. See ../shared/fixedOrientation.ts.
 *
 * Everything else — the whole BoxContainer and Control set — arrives through
 * the NODE_BASE_TYPES base-walk and is not re-declared here.
 */

import '../boxcontainer/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { fixedOrientation } from '../shared/fixedOrientation.js';

validatorRegistry.registerAll('VBoxContainer', {
  vertical: fixedOrientation('VBoxContainer'),
});
