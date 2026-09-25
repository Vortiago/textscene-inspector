/** Semantic rules for Range: an inverted min/max pair and a negative min under `exp_edit`. */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { parseGodotFloat } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';

function checkRangeBounds(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const diagnostics: Diagnostic[] = [];
  const props = node.properties as Record<string, string>;
  const minRaw = props.min_value;
  const maxRaw = props.max_value;

  // Error tier: `set_max` stores `MAX(p_max, shared->min)` (scene/gui/range.cpp:229)
  // and `set_min` raises max the same way (range.cpp:217), so either load
  // order collapses the range to a point at `min_value`. The .tscn keeps the
  // inverted pair, so without this rule the collapse is invisible.
  if (minRaw !== undefined && maxRaw !== undefined) {
    const min = parseGodotFloat(minRaw);
    const max = parseGodotFloat(maxRaw);
    // The MAX() at range.cpp:217 does not collapse a nan pair, so `nan` has
    // no single point to report.
    if (min !== null && max !== null && !Number.isNaN(min) && !Number.isNaN(max) && max < min) {
      diagnostics.push({
        severity: 'error',
        message: `${node.type} '${node.name}' has 'max_value = ${maxRaw}' below 'min_value = ${minRaw}'. Godot's Range::set_max clamps max_value up to min_value rather than honouring the inverted pair, so the range collapses to a single point at ${minRaw} instead of spanning what's authored.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'range-max-below-min',
      });
    }
  }

  // `get_configuration_warnings()` (range.cpp:71-79) warns on `exp_ratio && min < 0`.
  // `exp_edit` (range.cpp:411) defaults false and `min_value` 0.0 (range.h:40,44),
  // so both must be authored.
  if (boolSlotValue(props.exp_edit) === true && minRaw !== undefined) {
    const min = parseGodotFloat(minRaw);
    if (min !== null && !Number.isNaN(min) && min < 0) {
      diagnostics.push({
        severity: 'warning',
        message: `${node.type} '${node.name}' has 'exp_edit' enabled with 'min_value = ${minRaw}'. Exp Edit requires Min Value to be greater than or equal to 0.`,
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
        severity: 'error',
        grounding: { kind: 'engine', at: 'range.cpp:229' },
      },
      { ruleName: 'range-exp-edit-negative-min', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkRangeBounds,
};

ruleRegistry.register(rangeBoundsRule);

export { rangeBoundsRule };
