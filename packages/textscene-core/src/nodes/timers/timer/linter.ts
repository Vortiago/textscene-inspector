/**
 * Semantic linter rule for Timer: `Timer::get_configuration_warnings()`
 * (timer.cpp:200-208) warns when `wait_time < 0.05 - CMP_EPSILON`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { CMP_EPSILON } from '../../../godot/math.js';
import { parseGodotFloat } from '../../../linter/validators/commonValidators.js';

const LOW_WAIT_TIME_THRESHOLD = 0.05 - CMP_EPSILON;

function checkTimerWaitTime(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const raw = props.wait_time;
  if (raw === undefined) return [];
  const waitTime = parseGodotFloat(raw);
  if (waitTime === null || !Number.isFinite(waitTime)) return [];

  // Godot's guard has no lower bound, but the setter refuses `<= 0` (timer.cpp:93),
  // an error from v.positiveFloat. The `> 0` clause is this repo's, not timer.cpp's:
  // it keeps one defect from being reported at two severities.
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
    emits: [{ ruleName: 'timer-low-wait-time', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkTimerWaitTime,
};

ruleRegistry.register(timerWaitTimeRule);

export { timerWaitTimeRule };
