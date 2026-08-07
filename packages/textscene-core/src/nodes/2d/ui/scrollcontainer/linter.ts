/**
 * Semantic linter rule for ScrollContainer — Godot's own configuration
 * warning, `ScrollContainer::get_configuration_warnings()`
 * (scroll_container.cpp:768-786):
 *
 *     int found = 0;
 *     for (int i = 0; i < get_child_count(); i++) {
 *         Control *c = as_sortable_control(get_child(i), SortableVisibilityMode::VISIBLE);
 *         if (!c || c == h_scroll || c == v_scroll || c == focus_panel ||
 *                 c == scroll_hint_top_left || c == scroll_hint_bottom_right) {
 *             continue;
 *         }
 *         found++;
 *     }
 *     if (found != 1) {
 *         warnings.push_back(RTR("ScrollContainer is intended to work with a
 *             single child control.\nUse a container as child (VBox, HBox,
 *             etc.), or a Control and set the custom minimum size manually."));
 *     }
 *
 * The five named exclusions (`h_scroll`, `v_scroll`, `focus_panel`,
 * `scroll_hint_top_left`, `scroll_hint_bottom_right`) are internal children
 * ScrollContainer adds itself — never serialised to a `.tscn`, so a scene's
 * own children need no matching exclusion.
 *
 * `as_sortable_control` (container.cpp:143-155) is:
 *
 *     Control *c = Object::cast_to<Control>(p_node);
 *     if (!c || c->is_set_as_top_level()) return nullptr;
 *     if (p_visibility_mode == VISIBLE && !c->is_visible()) return nullptr;
 *     return c;
 *
 * `is_visible()` reads the node's OWN `visible` flag, not
 * `is_visible_in_tree()` — an ancestor's visibility does not enter into it.
 *
 * `found != 1` fires on ZERO sortable children just as much as on two or
 * more — an empty ScrollContainer is not exempt.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

/** `as_sortable_control(child, VISIBLE)` is non-null, per container.cpp:143-155. */
function isSortableControl(child: TscnNode): boolean {
  if (!descendsFrom(child.type, 'Control')) return false;
  const props = isValidProperties(child.properties) ? child.properties : {};
  if (props.top_level === 'true') return false;
  if (props.visible === 'false') return false;
  return true;
}

function checkScrollContainer(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children ?? [];

  // Instance-opaque linting (CONTEXT.md): an `instance=` or typeless child's
  // real class lives in a sub-scene this linter never opens, so it may or may
  // not be the one sortable Control this rule is counting for. Staying silent
  // beats guessing the count wrong in either direction.
  if (children.some((child) => child.instance || !child.type)) return [];

  const sortableCount = children.filter(isSortableControl).length;
  if (sortableCount === 1) return [];

  return [
    {
      severity: 'warning',
      message: `ScrollContainer '${node.name}' has ${sortableCount} sortable child controls; it is intended to work with exactly one. Use a container as the single child (VBoxContainer, HBoxContainer, …), or a single Control with its custom minimum size set manually.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'scrollcontainer-not-single-child',
    },
  ];
}

const scrollContainerRule: LintRule = {
  meta: {
    name: 'valid-scrollcontainer-single-child',
    description:
      'Flags a ScrollContainer that does not have exactly one sortable Control child',
    category: 'validation',
    applicableNodeTypes: ['ScrollContainer'],
    emits: [{ ruleName: 'scrollcontainer-not-single-child', severity: 'warning' }],
  },
  check: checkScrollContainer,
};

ruleRegistry.register(scrollContainerRule);

export { scrollContainerRule };
