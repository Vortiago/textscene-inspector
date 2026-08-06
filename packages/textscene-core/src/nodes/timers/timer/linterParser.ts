/** Timer strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const PROCESS_CALLBACK_VALUES = { 0: 'PHYSICS', 1: 'IDLE' };

// Timer is a plain Node (see nodeBaseTypes.ts) — no spatial validators;
// only the type-specific property surface is registered here.
validatorRegistry.registerAll('Timer', {
  // timer.cpp:93, ERR_FAIL_COND_MSG(p_time <= 0, "Time should be greater than zero.").
  wait_time: v.positiveFloat(
    'wait_time',
    "Property 'wait_time' must be greater than 0. A Timer needs a positive interval to fire.",
    { enforced: 'timer.cpp:93' }
  ),
  autostart: v.boolean('autostart'),
  one_shot: v.boolean('one_shot'),
  paused: v.boolean('paused'),
  // timer.cpp:163-179, set_timer_process_callback is a bare switch/assign; no
  // engine-side range check on the raw int.
  process_callback: v.enumInt('process_callback', 0, 1, PROCESS_CALLBACK_VALUES, {
    hinted: 'timer.cpp:239',
  }),
  ignore_time_scale: v.boolean('ignore_time_scale'),
});
