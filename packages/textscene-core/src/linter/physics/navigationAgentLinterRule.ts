/**
 * Dimension-parameterized semantic linter rule for NavigationAgent2D / NavigationAgent3D,
 * from Godot's own configuration warning, `get_configuration_warnings()`
 * (navigation_agent_2d.cpp:722-730):
 *
 *     if (!Object::cast_to<Node2D>(get_parent())) {
 *         warnings.push_back(RTR("The NavigationAgent2D can be used only under a Node2D inheriting parent node."));
 *     }
 *
 * The 3D form (navigation_agent_3d.cpp:789-797) substitutes Node3D/NavigationAgent3D
 * throughout and is otherwise identical: same guard, same message shape.
 *
 * Not cosmetic: `set_agent_parent` casts the parent to the dimension's Node type and,
 * when the cast fails, clears the agent's navigation map instead of ever placing it
 * (`agent_set_map(get_rid(), RID())`) — the whole node is inert, with no position to
 * report and no map to path through. 2D: cpp:385-410, clear at cpp:408. 3D: cpp:422-447,
 * clear at cpp:445. Advisory, hence a warning: the scene loads and every property is
 * well-formed.
 *
 * NavigationAgent2D/3D have no subclasses of their own, so this matches the exact type
 * rather than walking `descendsFrom` the way a rule mirroring a base class's warning would.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { parentTypeVerdict, placementPhrase } from '../parentType.js';

export function makeNavigationAgentLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationAgent${dim}`;
  const parentType = `Node${dim}`;
  const suffix = dimSuffix(dim);
  const ruleName = `navigationagent${suffix}-parent-not-node${suffix}`;

  function check(context: RuleContext): Diagnostic[] {
    const { node, scene } = context;

    const verdict = parentTypeVerdict(scene, node, parentType);
    if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

    return [
      {
        severity: 'warning',
        message: `${type} '${node.name}' is ${placementPhrase(verdict)}. ${type} only works as a child of a ${parentType}-inheriting node; elsewhere it has no position to steer and is never placed on the navigation map.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName,
      },
    ];
  }

  return {
    meta: {
      name: `valid-navigationagent${suffix}`,
      description: `Warns when a ${type} is not a child of a ${parentType}-inheriting node, where Godot never places it on the navigation map`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [{ ruleName, severity: 'warning' }],
    },
    check,
  };
}
