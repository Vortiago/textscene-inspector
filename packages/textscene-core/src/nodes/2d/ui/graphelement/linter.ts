/**
 * Semantic rule for GraphElement: `selected = true` authored with
 * `selectable = false`. Error tier (ADR-0032): `set_selectable(false)` calls
 * `set_selected(false)` before it stores the flag (`scene/gui/graph_element.cpp`),
 * and `set_selected` returns early once `is_selectable()` is false.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { boolSlotValue } from '../../../../godot/index.js';

// Either load order ends unselected: `selectable` first makes the later
// `selected = true` a no-op, and `selected` first is undone by the
// `set_selected(false)` that `set_selectable(false)` runs while `is_selectable()`
// still reads true. The .tscn keeps showing `selected = true`.
function checkSelectedRequiresSelectable(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const selectableRaw = props.selectable;
  const selectedRaw = props.selected;
  if (selectableRaw === undefined || selectedRaw === undefined) return [];
  if (boolSlotValue(selectableRaw) !== false || boolSlotValue(selectedRaw) !== true) return [];

  return [
    {
      severity: 'error',
      message:
        "GraphElement has 'selected = true' alongside 'selectable = false'. Godot's " +
        'GraphElement::set_selectable forces set_selected(false) whenever selectable ' +
        'becomes false, regardless of load order, so this element always loads ' +
        'deselected — the authored selected value never takes effect.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'graph-element-selected-not-selectable',
    },
  ];
}

const selectedRequiresSelectableRule: LintRule = {
  meta: {
    name: 'valid-graph-element-selection',
    description:
      'Flags a GraphElement authored with selected = true and selectable = false — Godot ' +
      'always forces the element back to deselected regardless of load order',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'GraphElement'),
    emits: [
      {
        ruleName: 'graph-element-selected-not-selectable',
        severity: 'error',
        grounding: { kind: 'engine', at: 'graph_element.cpp:207' },
      },
    ],
  },
  check: checkSelectedRequiresSelectable,
};

ruleRegistry.register(selectedRequiresSelectableRule);

export { selectedRequiresSelectableRule };
