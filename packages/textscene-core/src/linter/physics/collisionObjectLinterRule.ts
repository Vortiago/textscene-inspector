/**
 * The configuration warning every collision object shares: no shape child.
 * `CollisionObject2D::get_configuration_warnings` (collision_object_2d.cpp:588)
 * and `CollisionObject3D`'s (:739) push it for every subclass, so one rule per
 * dimension reaches the whole family through `descendsFrom`.
 */

import type { Diagnostic, LintRule, RuleContext } from '../types.js';
import { armEmits, reportArm, type RuleArms } from '../ruleArms.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { collisionShapeTypesPhrase, hasCollisionShapeChild } from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeCollisionObjectLinterRule(dim: PhysicsDim): LintRule {
  const base = `CollisionObject${dim}`;
  const prefix = `collisionobject${dimSuffix(dim)}`;
  const cite = dim === '2D' ? 'collision_object_2d.cpp:588' : 'collision_object_3d.cpp:739';
  const arms = {
    needsCollisionShape: {
      severity: 'warning',
      ruleName: `${prefix}-needs-collision-shape`,
      grounding: { kind: 'configuration-warning' },
    },
  } as const satisfies RuleArms<'needsCollisionShape'>;

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;
    const diagnostics: Diagnostic[] = [];
    if (!hasCollisionShapeChild(node, dim)) {
      reportArm(
        diagnostics,
        arms.needsCollisionShape,
        node,
        `${node.type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children, so it ` +
          `cannot collide or interact with other objects (${cite}).`
      );
    }
    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Warns when a ${base}-derived node has no collision shape child`,
      category: 'validation',
      applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, base),
      emits: armEmits(arms),
    },
    check,
  };
}
