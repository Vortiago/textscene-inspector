/**
 * Semantic linter rule for Control — `Control::get_configuration_warnings()`
 * (control.cpp:246-256):
 *
 *     PackedStringArray warnings = CanvasItem::get_configuration_warnings();
 *     if (data.mouse_filter == MOUSE_FILTER_IGNORE && !data.tooltip.is_empty()) {
 *         warnings.push_back(RTR("The Hint Tooltip won't be displayed as the
 *             control's Mouse Filter is set to \"Ignore\". To solve this, set
 *             the Mouse Filter to \"Stop\" or \"Pass\"."));
 *     }
 *     return warnings;
 *
 * The guard tests EQUALITY with IGNORE (control.h:89-91: STOP=0, PASS=1,
 * IGNORE=2), not inequality with STOP — so a resolved default of PASS behaves
 * exactly like STOP here: neither is IGNORE, so neither warns. It also reads
 * `data.mouse_filter` directly, never `get_mouse_filter_with_override()`, so no
 * ancestor's filter enters into it — only this node's own value.
 *
 * `mouse_filter`'s own default is NOT uniform across Control, which is why
 * absence cannot simply be read as "not IGNORE". Control's field initialiser is
 * STOP (control.h:237), but two subclasses override it to IGNORE in their own
 * constructor: `Label::Label()` (label.cpp:1477) and
 * `NinePatchRect::NinePatchRect()` (nine_patch_rect.cpp:191). A full sweep of
 * every bare (self, not a child node's) `set_mouse_filter(MOUSE_FILTER_*)` call
 * across `scene/` and `modules/` finds exactly thirteen: Container overrides to
 * PASS (container.cpp:233, irrelevant here since PASS != IGNORE either way),
 * ten more re-affirm STOP or override to PASS on their own subtree (Button,
 * LineEdit, GraphFrame, FoldableContainer, Panel, GraphNode, PanelContainer,
 * TextureRect, TextureProgressBar, Tree — none IGNORE), and only Label and
 * NinePatchRect land on IGNORE. So those two are the complete set.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { unquoteString } from '../../../../parser/utils.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

// control.h:89-91: MouseFilter { STOP, PASS, IGNORE }.
const MOUSE_FILTER_IGNORE = 2;

/** Constructors that set their OWN default `mouse_filter` to IGNORE, rather than inheriting Control's STOP. */
const MOUSE_FILTER_IGNORE_BY_DEFAULT = new Set(['Label', 'NinePatchRect']);

function resolvedMouseFilterIsIgnore(node: { type: string; properties: unknown }): boolean {
  const props = isValidProperties(node.properties) ? node.properties : {};
  const raw = props.mouse_filter;
  if (raw !== undefined) {
    return ruleInt(raw) === MOUSE_FILTER_IGNORE;
  }
  return MOUSE_FILTER_IGNORE_BY_DEFAULT.has(node.type);
}

function checkControlTooltip(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const tooltip = props.tooltip_text;
  if (tooltip === undefined) return [];
  // Godot compares String::is_empty(); an authored empty-string literal means
  // "no tooltip" the same way an absent key does.
  if (unquoteString(tooltip) === '') return [];

  if (!resolvedMouseFilterIsIgnore(node)) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' sets 'tooltip_text' but its Mouse Filter resolves to Ignore, so the tooltip will never be displayed. Set Mouse Filter to Stop or Pass instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    },
  ];
}

const controlTooltipRule: LintRule = {
  meta: {
    name: 'valid-control-tooltip-mouse-filter',
    description:
      'Flags a tooltip that can never be displayed because the control (own value, default per-subclass) resolves Mouse Filter to Ignore',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Control'),
    emits: [{ ruleName: 'control-tooltip-ignored-by-mouse-filter', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkControlTooltip,
};

ruleRegistry.register(controlTooltipRule);

export { controlTooltipRule };
