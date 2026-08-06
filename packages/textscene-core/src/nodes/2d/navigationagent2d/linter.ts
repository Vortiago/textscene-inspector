/**
 * Semantic linter rule for NavigationAgent2D, from Godot's own configuration
 * warning, `NavigationAgent2D::get_configuration_warnings()`
 * (navigation_agent_2d.cpp:722-730):
 *
 *     if (!Object::cast_to<Node2D>(get_parent())) {
 *         warnings.push_back(RTR("The NavigationAgent2D can be used only under a Node2D inheriting parent node."));
 *     }
 *
 * Not cosmetic: `set_agent_parent` (cpp:385-410) casts the parent to Node2D and,
 * when the cast fails, clears the agent's navigation map instead of ever placing
 * it (`agent_set_map(get_rid(), RID())`, cpp:408) — the whole node is inert, with
 * no position to report and no map to path through. Advisory, hence a warning:
 * the scene loads and every property is well-formed.
 *
 * NavigationAgent2D has no subclasses of its own, so this matches its exact
 * type rather than walking `descendsFrom` the way a rule mirroring a base
 * class's warning would.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { findParentNode } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';

const RULE = 'navigationagent2d-parent-not-node2d';

function checkNavigationAgent2D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const parent = findParentNode(scene.nodes, node);

  // An instanced parent's type lives in another file; the linter never opens it.
  if (parent && (parent.instance || !parent.type)) return [];
  if (parent && descendsFrom(parent.type, 'Node2D')) return [];

  const where = parent ? `a child of a ${parent.type} node` : 'the scene root';
  return [
    {
      severity: 'warning',
      message: `NavigationAgent2D '${node.name}' is ${where}. NavigationAgent2D only works as a child of a Node2D-inheriting node; elsewhere it has no position to steer and is never placed on the navigation map.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE,
    },
  ];
}

const navigationAgent2DParentRule: LintRule = {
  meta: {
    name: 'valid-navigationagent2d-parent',
    description:
      'Warns when a NavigationAgent2D is not a child of a Node2D-inheriting node, where Godot never places it on the navigation map',
    category: 'validation',
    applicableNodeTypes: ['NavigationAgent2D'],
    emits: [{ ruleName: RULE, severity: 'warning' }],
  },
  check: checkNavigationAgent2D,
};

ruleRegistry.register(navigationAgent2DParentRule);

export { navigationAgent2DParentRule };
