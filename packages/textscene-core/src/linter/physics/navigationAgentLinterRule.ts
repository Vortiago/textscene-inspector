/**
 * The NavigationAgent2D/3D configuration warning for a parent that is not a
 * Node2D/Node3D: `get_configuration_warnings()` (navigation_agent_2d.cpp:722-730,
 * navigation_agent_3d.cpp:789-797), the same guard and message shape in both.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { armDiagnostic, armEmits, type RuleArms } from '../ruleArms.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import { parentTypeVerdict, placementPhrase } from '../parentType.js';

export function makeNavigationAgentLinterRule(dim: PhysicsDim): LintRule {
  const type = `NavigationAgent${dim}`;
  const parentType = `Node${dim}`;
  const suffix = dimSuffix(dim);
  const arms = {
    parentNotNode: {
      severity: 'warning',
      ruleName: `navigationagent${suffix}-parent-not-node${suffix}`,
      grounding: { kind: 'configuration-warning' },
    },
  } as const satisfies RuleArms<'parentNotNode'>;

  function check(context: RuleContext): Diagnostic[] {
    const { node, scene } = context;

    // `set_agent_parent` clears the agent's map when the parent cast fails
    // (`agent_set_map(get_rid(), RID())`), so the node is inert. 2D: cpp:385-410,
    // clear at cpp:408. 3D: cpp:422-447, clear at cpp:445. A warning: the scene
    // loads and every property is well-formed.
    const verdict = parentTypeVerdict(scene, node, parentType);
    if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

    return [
      armDiagnostic(
        arms.parentNotNode,
        node,
        `${type} '${node.name}' is ${placementPhrase(verdict)}. ${type} only works as a child of a ${parentType}-inheriting node; elsewhere it has no position to steer and is never placed on the navigation map.`
      ),
    ];
  }

  return {
    meta: {
      name: `valid-navigationagent${suffix}`,
      description: `Warns when a ${type} is not a child of a ${parentType}-inheriting node, where Godot never places it on the navigation map`,
      category: 'validation',
      // No subclasses, so the exact type, not `descendsFrom`.
      applicableNodeTypes: [type],
      emits: armEmits(arms),
    },
    check,
  };
}
