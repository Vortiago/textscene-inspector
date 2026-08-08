/**
 * Semantic rules for Range.
 *
 * 1. An authored max_value below min_value.
 *
 * Advisory (WARNING, never error): this is legal Godot. `Range::set_max`
 * clamps rather than rejects (scene/gui/range.cpp:229:
 * `double max_validated = MAX(p_max, shared->min);`), and `Range::set_min`
 * clamps the opposite direction the same way (range.cpp:216:
 * `shared->max = MAX(shared->max, shared->min);`) — so regardless of which
 * property the deserializer applies first, the two setters converge on the
 * same fixed point: `max_value` ends up `MAX(authored max_value, authored
 * min_value)`, i.e. the range collapses to a single point at `min_value`
 * rather than the (still-legal) inverted numbers the .tscn keeps showing.
 * The warning exists because that collapse is otherwise invisible.
 *
 * 2. `Range::get_configuration_warnings()` (range.cpp:71-79):
 *
 *     if (shared->exp_ratio && shared->min < 0) {
 *         warnings.push_back(RTR("If \"Exp Edit\" is enabled, \"Min Value\" must
 *             be greater or equal to 0."));
 *     }
 *
 * `exp_edit` (ADD_PROPERTY name for `exp_ratio`, range.cpp:411) defaults false
 * and `min_value` defaults 0.0 (range.h:40,44), so an absent key on either side
 * cannot trigger this — both must be authored.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

function checkRangeBounds(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const diagnostics: Diagnostic[] = [];
  const props = node.properties as Record<string, string>;
  const minRaw = props.min_value;
  const maxRaw = props.max_value;

  if (minRaw !== undefined && maxRaw !== undefined) {
    const min = parseFloat(minRaw);
    const max = parseFloat(maxRaw);
    if (!isNaN(min) && !isNaN(max) && max < min) {
      diagnostics.push({
        severity: 'warning',
        message: `Range 'max_value = ${maxRaw}' is below 'min_value = ${minRaw}'. Godot's Range::set_max clamps max_value up to min_value rather than honouring the inverted pair, so the range collapses to a single point at ${minRaw} instead of spanning what's authored.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'range-max-below-min',
      });
    }
  }

  if (props.exp_edit === 'true' && minRaw !== undefined) {
    const min = parseFloat(minRaw);
    if (!isNaN(min) && min < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `Range '${node.name}' has 'exp_edit' enabled with 'min_value = ${minRaw}'. Exp Edit requires Min Value to be greater than or equal to 0.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'range-exp-edit-negative-min',
      });
    }
  }

  return diagnostics;
}

const rangeBoundsRule: LintRule = {
  meta: {
    name: 'valid-range-bounds',
    description:
      'Flags a Range whose max_value is authored below min_value, or whose Exp Edit is enabled with a negative min_value',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Range'),
    emits: [
      {
        ruleName: 'range-max-below-min',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'range.cpp:229' },
      },
      { ruleName: 'range-exp-edit-negative-min', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkRangeBounds,
};

ruleRegistry.register(rangeBoundsRule);

export { rangeBoundsRule };
