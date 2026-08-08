/**
 * Semantic rule for GraphElement — `selected = true` authored alongside
 * `selectable = false`.
 *
 * Advisory (WARNING, never error): both values are individually legal Godot,
 * but `scene/gui/graph_element.cpp`'s `set_selectable` forces the element out
 * of selection whenever it is made unselectable, regardless of which property
 * the deserializer applies first:
 *
 *   void GraphElement::set_selectable(bool p_selectable) {
 *       if (!p_selectable) {
 *           set_selected(false);
 *       }
 *       selectable = p_selectable;
 *   }
 *
 * `set_selected` in turn only takes effect while `is_selectable()` is still
 * true:
 *
 *   void GraphElement::set_selected(bool p_selected) {
 *       if (!is_selectable() || selected == p_selected) {
 *           return;
 *       }
 *       selected = p_selected;
 *       ...
 *   }
 *
 * Working through both orderings a text-resource loader could apply the two
 * properties in: if `selectable = false` loads first, `is_selectable()` is
 * already false by the time `selected = true` loads, so that call is a no-op
 * and `selected` stays false. If `selected = true` loads first, `selected`
 * becomes true, then `selectable = false` loading immediately calls
 * `set_selected(false)` — `is_selectable()` still reads the pre-update `true`
 * at that point, so the call *does* take effect and forces `selected` back to
 * false. Either order converges on the same fixed point: a GraphElement can
 * never actually load as selected while unselectable, even though the .tscn
 * text keeps showing `selected = true`.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

function checkSelectedRequiresSelectable(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const selectableRaw = props.selectable;
  const selectedRaw = props.selected;
  if (selectableRaw === undefined || selectedRaw === undefined) return [];
  if (selectableRaw.trim() !== 'false' || selectedRaw.trim() !== 'true') return [];

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
