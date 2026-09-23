/**
 * ScrollContainer's configuration warning, `get_configuration_warnings()`
 * (scroll_container.cpp:768-786): `found != 1` sortable children, so zero warns
 * too. The five internal children it skips are never serialised.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { boolSlotValue } from '../../../../godot/index.js';

/**
 * `as_sortable_control(child, VISIBLE)` is non-null, per container.cpp:143-155:
 * a Control, not top-level, with its own `visible` set. An ancestor's
 * visibility does not count.
 */
function isSortableControl(child: TscnNode): boolean {
  if (!descendsFrom(child.type, 'Control')) return false;
  const props = isValidProperties(child.properties) ? child.properties : {};
  if (boolSlotValue(props.top_level) === true) return false;
  if (boolSlotValue(props.visible) === false) return false;
  return true;
}

function checkScrollContainer(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children ?? [];

  // Instance-opaque linting (CONTEXT.md): an `instance=` or typeless child's
  // class lives in a sub-scene the linter never opens, so the count is unknown.
  if (children.some(isTypeUnknowable)) return [];

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
    emits: [{ ruleName: 'scrollcontainer-not-single-child', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkScrollContainer,
};

ruleRegistry.register(scrollContainerRule);

export { scrollContainerRule };
