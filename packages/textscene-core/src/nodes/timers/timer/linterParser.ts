/** Timer strict validators for linting. */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const PROCESS_CALLBACK_VALUES = { 0: 'PHYSICS', 1: 'IDLE' };

// Timer is a plain Node (see nodeBaseTypes.ts) — no spatial validators;
// only the type-specific property surface is registered here.
validatorRegistry.registerAll('Timer', {
  wait_time: v.positiveFloat(
    'wait_time',
    "Property 'wait_time' must be greater than 0. A Timer needs a positive interval to fire."
  ),
  autostart: v.boolean('autostart'),
  one_shot: v.boolean('one_shot'),
  paused: v.boolean('paused'),
  process_callback: v.enumInt('process_callback', 0, 1, PROCESS_CALLBACK_VALUES),
  ignore_time_scale: v.boolean('ignore_time_scale'),
});
