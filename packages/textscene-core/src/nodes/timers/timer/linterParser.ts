/** Timer strict validators for linting. */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key only if the ancestor is imported too.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const PROCESS_CALLBACK_VALUES = { 0: 'PHYSICS', 1: 'IDLE' };

// Timer is a plain Node (nodeBaseTypes.ts), so only its own property surface
// is registered here.
validatorRegistry.registerAll('Timer', {
  // timer.cpp:93, ERR_FAIL_COND_MSG(p_time <= 0, "Time should be greater than
  // zero."), against a hint (:240) of "0.001,4096,0.001,or_greater,exp,suffix:s"
  // whose ceiling `or_greater` opens. The two floors sit apart, so (0, 0.001)
  // loads into Godot and only warns.
  wait_time: v.positiveFloat(
    'wait_time',
    "Property 'wait_time' must be greater than 0. A Timer needs a positive interval to fire.",
    { min: 0.001, enforced: 'timer.cpp:93', hinted: 'timer.cpp:240' }
  ),
  autostart: v.boolean('autostart'),
  one_shot: v.boolean('one_shot'),
  paused: v.boolean('paused'),
  // timer.cpp:163-179: set_timer_process_callback is a bare switch and assign
  // with no range check on the raw int.
  process_callback: v.enumInt('process_callback', 0, 1, PROCESS_CALLBACK_VALUES, {
    hinted: 'timer.cpp:239',
  }),
  ignore_time_scale: v.boolean('ignore_time_scale'),
});
