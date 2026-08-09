/**
 * Semantic linter rule for PhysicalBone3D.
 *
 * `CollisionObject3D::get_configuration_warnings()` (collision_object_3d.cpp:739)
 *
 *     if (shapes.is_empty()) {
 *         warnings.push_back(RTR("This node has no shape, so it can't collide
 *             or interact with other objects. ..."));
 *     }
 *
 * reaches every CollisionObject3D descendant, but this repo implements that
 * ONE Godot condition as one rule per family (`area3d-needs-collision-shape`,
 * `staticbody3d-needs-collision-shape`, `characterbody3d-needs-collision-shape`,
 * `rigidbody3d-needs-collision-shape`) rather than a single base-walking rule —
 * and PhysicalBone3D, whose chain is PhysicsBody3D -> CollisionObject3D, sits
 * outside all four: it has no `linter.ts` of its own, and no family rule's
 * `applicableNodeTypeMatcher` reaches it. This file is that fifth family.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from '../../../../linter/physics/hasCollisionShapeChild.js';

const RULE_NAME = 'physicalbone3d-needs-collision-shape';

function checkPhysicalBone3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (hasCollisionShapeChild(node, '3D')) return [];

  return [
    {
      severity: 'warning',
      message: `PhysicalBone3D '${node.name}' has no ${collisionShapeTypesPhrase('3D')} children. It has no shape, so it can't collide or interact with other objects.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const physicalBone3DValidationRule: LintRule = {
  meta: {
    name: 'valid-physicalbone3d-collision-shape',
    description: "Warns when a PhysicalBone3D has no CollisionShape3D or CollisionPolygon3D descendant to give it a shape",
    category: 'validation',
    applicableNodeTypes: ['PhysicalBone3D'],
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkPhysicalBone3D,
};

ruleRegistry.register(physicalBone3DValidationRule);

export { physicalBone3DValidationRule };
