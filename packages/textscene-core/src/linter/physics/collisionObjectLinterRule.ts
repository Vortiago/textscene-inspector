/**
 * The configuration warning every collision object shares: no shape child.
 * `CollisionObject2D::get_configuration_warnings` (collision_object_2d.cpp:588)
 * and `CollisionObject3D`'s (:739) push it for every subclass, so one rule per
 * dimension reaches the whole family through `descendsFrom`.
 */

import type { Diagnostic, LintRule, RuleContext } from '../types.js';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { collisionShapeTypesPhrase, hasCollisionShapeChild } from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeCollisionObjectLinterRule(dim: PhysicsDim): LintRule {
  const base = `CollisionObject${dim}`;
  const prefix = `collisionobject${dimSuffix(dim)}`;
  const cite = dim === '2D' ? 'collision_object_2d.cpp:588' : 'collision_object_3d.cpp:739';

  function check(context: RuleContext): Diagnostic[] {
    const { node } = context;
    const diagnostics: Diagnostic[] = [];
    if (!hasCollisionShapeChild(node, dim)) {
      diagnostics.push({
        severity: 'warning',
        message:
          `${node.type} '${node.name}' has no ${collisionShapeTypesPhrase(dim)} children, so it ` +
          `cannot collide or interact with other objects (${cite}).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }
    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Warns when a ${base}-derived node has no collision shape child`,
      category: 'validation',
      applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, base),
      emits: [
        {
          ruleName: `${prefix}-needs-collision-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
      ],
    },
    check,
  };
}
