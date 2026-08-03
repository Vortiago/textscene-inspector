/**
 * Dimension-parameterized semantic linter rule for Area2D / Area3D.
 *
 * The two slices were byte-identical after a 2D↔3D token swap, so a single
 * factory builds both. Format validation stays in each slice's linterParser.ts;
 * this rule handles the semantic checks that need full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { hasCollisionShapeChild } from './hasCollisionShapeChild.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeAreaLinterRule(dim: PhysicsDim): LintRule {
  const type = `Area${dim}`;
  const shapeType = `CollisionShape${dim}`;
  const prefix = `area${dimSuffix(dim)}`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // Warning: Area without collision shape won't detect anything
    if (!hasCollisionShapeChild(node, shapeType)) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no ${shapeType} children. Areas need collision shapes to detect bodies entering/exiting.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-needs-collision-shape`,
      });
    }

    // Warning: Both monitoring and monitorable false - area does nothing
    const monitoring = rawProps.monitoring ?? 'true'; // Default is true in Godot
    const monitorable = rawProps.monitorable ?? 'true'; // Default is true in Godot
    if (monitoring === 'false' && monitorable === 'false') {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has both 'monitoring' and 'monitorable' set to false. This area cannot detect other bodies and cannot be detected by other areas.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-inactive`,
      });
    }

    // Error: gravity_point is true but gravity_point_unit_distance is not set or <= 0
    const gravityPoint = rawProps.gravity_point === 'true';
    const gravityPointUnitDistance = rawProps.gravity_point_unit_distance;
    if (gravityPoint) {
      if (!gravityPointUnitDistance) {
        diagnostics.push({
          severity: 'error',
          message: `${type} '${node.name}' has 'gravity_point' enabled but 'gravity_point_unit_distance' is not set. This property is required for point gravity calculations.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-point-gravity-missing-distance`,
        });
      } else {
        const distance = parseFloat(gravityPointUnitDistance);
        if (!isNaN(distance) && distance <= 0) {
          diagnostics.push({
            severity: 'error',
            message: `${type} '${node.name}' has 'gravity_point' enabled but 'gravity_point_unit_distance' is ${distance}. This value must be greater than 0 for point gravity to work.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-point-gravity-invalid-distance`,
          });
        }
      }
    }

    // Warning: collision_layer is 0 and monitoring is true (won't detect on any layer)
    const collisionLayer = rawProps.collision_layer;
    if (monitoring === 'true' && collisionLayer !== undefined) {
      const layer = parseInt(collisionLayer, 10);
      if (!isNaN(layer) && layer === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has 'monitoring' enabled but 'collision_layer' is 0. The area won't be on any collision layer.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-monitoring-zero-layer`,
        });
      }
    }

    // Warning: collision_mask is 0 and monitoring is true (won't detect anything)
    const collisionMask = rawProps.collision_mask;
    if (monitoring === 'true' && collisionMask !== undefined) {
      const mask = parseInt(collisionMask, 10);
      if (!isNaN(mask) && mask === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has 'monitoring' enabled but 'collision_mask' is 0. The area won't detect any collision layers.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-monitoring-zero-mask`,
        });
      }
    }

    // Warning: Both layer and mask are 0 with monitoring enabled
    if (monitoring === 'true' && collisionLayer !== undefined && collisionMask !== undefined) {
      const layer = parseInt(collisionLayer, 10);
      const mask = parseInt(collisionMask, 10);
      if (!isNaN(layer) && !isNaN(mask) && layer === 0 && mask === 0) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has 'monitoring' enabled but both 'collision_layer' and 'collision_mask' are 0. The area won't detect anything.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-monitoring-no-collision`,
        });
      }
    }

    // Warning: audio_bus_override is true but audio_bus_name is not set
    const audioBusOverride = rawProps.audio_bus_override === 'true';
    const audioBusName = rawProps.audio_bus_name;
    if (audioBusOverride && !audioBusName) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has 'audio_bus_override' enabled but 'audio_bus_name' is not set. Specify which audio bus to use.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-audio-override-missing-name`,
      });
    }

    return diagnostics;
  }

  return {
    meta: {
      name: `valid-${prefix}`,
      description: `Validates ${type} collision shapes, monitoring configuration, gravity settings, and physics overrides`,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-needs-collision-shape`, severity: 'warning' },
        { ruleName: `${prefix}-inactive`, severity: 'warning' },
        { ruleName: `${prefix}-point-gravity-missing-distance`, severity: 'error' },
        { ruleName: `${prefix}-point-gravity-invalid-distance`, severity: 'error' },
        { ruleName: `${prefix}-monitoring-zero-layer`, severity: 'warning' },
        { ruleName: `${prefix}-monitoring-zero-mask`, severity: 'warning' },
        { ruleName: `${prefix}-monitoring-no-collision`, severity: 'warning' },
        { ruleName: `${prefix}-audio-override-missing-name`, severity: 'warning' },
      ],
    },
    check,
  };
}
