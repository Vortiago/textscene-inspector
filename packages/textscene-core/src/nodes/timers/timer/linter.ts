/**
 * Semantic linter rule for Timer — `Timer::get_configuration_warnings()`
 * (timer.cpp:200-208):
 *
 *     PackedStringArray warnings = Node::get_configuration_warnings();
 *     if (wait_time < 0.05 - CMP_EPSILON) {
 *         warnings.push_back(RTR("Very low timer wait times (< 0.05 seconds)
 *             may behave in significantly different ways depending on the
 *             rendered or physics frame rate.\nConsider using a script's
 *             process loop instead of relying on a Timer for very low wait
 *             times."));
 *     }
 *
 * The engine's own guard has no lower bound — `wait_time <= 0` also satisfies
 * `< 0.05 - CMP_EPSILON` — but `wait_time`'s OWN setter already
 * `ERR_FAIL_COND_MSG(p_time <= 0, ...)` (timer.cpp:93), which `linterParser.ts`
 * reports as an ERROR via `v.positiveFloat`. Repeating that range here at
 * warning tier would report the same defect twice at two severities, so this
 * rule narrows to `wait_time > 0`. That extra clause is THIS REPO's
 * de-duplication, not a second engine guard — do not read it back into
 * `timer.cpp`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { CMP_EPSILON } from '../../../godot/math.js';

const LOW_WAIT_TIME_THRESHOLD = 0.05 - CMP_EPSILON;

function checkTimerWaitTime(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const raw = props.wait_time;
  if (raw === undefined) return [];
  const waitTime = parseFloat(raw);
  if (!Number.isFinite(waitTime)) return [];

  // wait_time <= 0 is already an ERROR via v.positiveFloat (timer.cpp:93) —
  // this repo's de-dup, not part of Godot's own guard.
  if (waitTime <= 0 || waitTime >= LOW_WAIT_TIME_THRESHOLD) return [];

  return [
    {
      severity: 'warning',
      message: `Timer '${node.name}' has 'wait_time = ${raw}', below 0.05 seconds. Very low timer wait times behave differently across frame rates; consider a script's process loop instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'timer-low-wait-time',
    },
  ];
}

const timerWaitTimeRule: LintRule = {
  meta: {
    name: 'valid-timer-wait-time',
    description:
      'Flags a Timer with a very low positive wait_time (< 0.05s), which behaves differently across frame rates',
    category: 'validation',
    applicableNodeTypes: ['Timer'],
    emits: [{ ruleName: 'timer-low-wait-time', severity: 'warning' }],
  },
  check: checkTimerWaitTime,
};

ruleRegistry.register(timerWaitTimeRule);

export { timerWaitTimeRule };
