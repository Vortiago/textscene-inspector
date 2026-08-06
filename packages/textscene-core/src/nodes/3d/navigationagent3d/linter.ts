/**
 * Semantic linter rule for NavigationAgent3D, from Godot's own configuration
 * warning, `NavigationAgent3D::get_configuration_warnings()`
 * (navigation_agent_3d.cpp:789-797):
 *
 *     if (!Object::cast_to<Node3D>(get_parent())) {
 *         warnings.push_back(RTR("The NavigationAgent3D can be used only under a Node3D inheriting parent node."));
 *     }
 *
 * Not cosmetic: `set_agent_parent` (cpp:422-447) casts the parent to Node3D and,
 * when the cast fails, clears the agent's navigation map instead of ever placing
 * it (`agent_set_map(get_rid(), RID())`, cpp:445) — the whole node is inert, with
 * no position to report and no map to path through. Advisory, hence a warning:
 * the scene loads and every property is well-formed.
 *
 * NavigationAgent3D has no subclasses of its own, so this matches its exact
 * type rather than walking `descendsFrom` the way a rule mirroring a base
 * class's warning would.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { findParentNode } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';

const RULE = 'navigationagent3d-parent-not-node3d';

function checkNavigationAgent3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const parent = findParentNode(scene.nodes, node);

  // An instanced parent's type lives in another file; the linter never opens it.
  if (parent && (parent.instance || !parent.type)) return [];
  if (parent && descendsFrom(parent.type, 'Node3D')) return [];

  const where = parent ? `a child of a ${parent.type} node` : 'the scene root';
  return [
    {
      severity: 'warning',
      message: `NavigationAgent3D '${node.name}' is ${where}. NavigationAgent3D only works as a child of a Node3D-inheriting node; elsewhere it has no position to steer and is never placed on the navigation map.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE,
    },
  ];
}

const navigationAgent3DParentRule: LintRule = {
  meta: {
    name: 'valid-navigationagent3d-parent',
    description:
      'Warns when a NavigationAgent3D is not a child of a Node3D-inheriting node, where Godot never places it on the navigation map',
    category: 'validation',
    applicableNodeTypes: ['NavigationAgent3D'],
    emits: [{ ruleName: RULE, severity: 'warning' }],
  },
  check: checkNavigationAgent3D,
};

ruleRegistry.register(navigationAgent3DParentRule);

export { navigationAgent3DParentRule };
