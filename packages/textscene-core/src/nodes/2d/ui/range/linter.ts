/**
 * Semantic rule for Range — an authored max_value below min_value.
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
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

function checkRangeBounds(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!descendsFrom(node.type, 'Range')) return [];
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const minRaw = props.min_value;
  const maxRaw = props.max_value;
  if (minRaw === undefined || maxRaw === undefined) return [];

  const min = parseFloat(minRaw);
  const max = parseFloat(maxRaw);
  if (isNaN(min) || isNaN(max)) return [];

  if (max >= min) return [];

  return [
    {
      severity: 'warning',
      message: `Range 'max_value = ${maxRaw}' is below 'min_value = ${minRaw}'. Godot's Range::set_max clamps max_value up to min_value rather than honouring the inverted pair, so the range collapses to a single point at ${minRaw} instead of spanning what's authored.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'range-max-below-min',
    },
  ];
}

const rangeBoundsRule: LintRule = {
  meta: {
    name: 'valid-range-bounds',
    description:
      'Flags a Range whose max_value is authored below min_value — Godot clamps the range to a single point rather than rejecting it',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Range'),
    emits: [{ ruleName: 'range-max-below-min', severity: 'warning' }],
  },
  check: checkRangeBounds,
};

ruleRegistry.register(rangeBoundsRule);

export { rangeBoundsRule };
