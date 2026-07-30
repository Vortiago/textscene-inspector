/**
 * Dimension-parameterized semantic linter rule for VehicleBody3D.
 *
 * Godot has no 2D vehicle body, so `dim` is always '3D' today; the factory shape
 * is kept because ruleCoverage derives the rule name from it, and because the
 * sibling body rules (rigidBody/staticBody/characterBody) are all built this way.
 *
 * Format validation lives in the slice's linterParser.ts; this rule handles the
 * checks that need full scene context — the resource reference, and the two
 * structural facts that make a VehicleBody3D a vehicle rather than a rigid body:
 * it needs wheels, and it needs a collision shape.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { hasCollisionShapeChild } from './hasCollisionShapeChild.js';
import { pushZeroCollisionLayerMaskWarnings } from './collisionLayerMask.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';
import type { TscnNode } from '../../parser/types.js';

/** True when `node` has a descendant of `wheelType` at any depth. */
function hasWheelChild(node: TscnNode, wheelType: string): boolean {
  for (const child of node.children) {
    if (child.type === wheelType) return true;
    if (hasWheelChild(child, wheelType)) return true;
  }
  return false;
}

export function makeVehicleBodyLinterRule(dim: PhysicsDim): LintRule {
  const type = `VehicleBody${dim}`;
  const shapeType = `CollisionShape${dim}`;
  const wheelType = `VehicleWheel${dim}`;
  const prefix = `vehiclebody${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    const rawProps = node.properties as unknown as Record<string, string>;

    if (rawProps.physics_material_override) {
      if (!checkResourceExists(scene, rawProps.physics_material_override)) {
        diagnostics.push({
          severity: 'error',
          message: `Physics material resource not found: ${rawProps.physics_material_override}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

    // A vehicle body is driven entirely by its wheels: with none, engine_force
    // and steering do nothing at all and the body behaves as a plain RigidBody3D.
    if (!hasWheelChild(node, wheelType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${wheelType} children. A vehicle body is driven by its wheels; without them engine_force and steering have no effect.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-wheels`,
      });
    }

    if (!hasCollisionShapeChild(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Vehicle bodies need collision shapes for their chassis to collide with the world.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    pushZeroCollisionLayerMaskWarnings(diagnostics, node, rawProps, type, prefix);

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} resource references, wheels, collision shapes, and collision layers`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-needs-wheels`, severity: 'warning' },
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-layer`, severity: 'warning' },
        { ruleName: `${prefix}-zero-collision-mask`, severity: 'warning' },
      ],
    },
    check,
  };
}
