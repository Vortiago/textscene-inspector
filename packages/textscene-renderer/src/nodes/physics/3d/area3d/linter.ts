/**
 * Semantic linter rules for Area3D
 *
 * Note: Format validation (property types, value ranges) is handled by linterParser.ts.
 * This file focuses on semantic validation requiring full scene context.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

/**
 * Check if a node has any CollisionShape3D children (recursively)
 */
function hasCollisionShapeChild(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'CollisionShape3D') {
      return true;
    }
    // Check recursively in case collision shapes are nested deeper
    if (hasCollisionShapeChild(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate Area3D semantic rules
 */
function checkArea3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  // Only run for Area3D nodes
  if (node.type !== 'Area3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Warning: Area3D without CollisionShape3D children won't detect anything
  if (!hasCollisionShapeChild(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `Area3D '${node.name}' has no CollisionShape3D children. Areas need collision shapes to detect bodies entering/exiting.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'area3d-needs-collision-shape',
    });
  }

  // Warning: Both monitoring and monitorable false - area does nothing
  const monitoring = rawProps.monitoring ?? 'true'; // Default is true in Godot
  const monitorable = rawProps.monitorable ?? 'true'; // Default is true in Godot
  if (monitoring === 'false' && monitorable === 'false') {
    diagnostics.push({
      severity: 'warning',
      message: `Area3D '${node.name}' has both 'monitoring' and 'monitorable' set to false. This area cannot detect other bodies and cannot be detected by other areas.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'area3d-inactive',
    });
  }

  // Error: gravity_point is true but gravity_point_unit_distance is not set or <= 0
  const gravityPoint = rawProps.gravity_point === 'true';
  const gravityPointUnitDistance = rawProps.gravity_point_unit_distance;
  if (gravityPoint) {
    if (!gravityPointUnitDistance) {
      diagnostics.push({
        severity: 'error',
        message: `Area3D '${node.name}' has 'gravity_point' enabled but 'gravity_point_unit_distance' is not set. This property is required for point gravity calculations.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'area3d-point-gravity-missing-distance',
      });
    } else {
      const distance = parseFloat(gravityPointUnitDistance);
      if (!isNaN(distance) && distance <= 0) {
        diagnostics.push({
          severity: 'error',
          message: `Area3D '${node.name}' has 'gravity_point' enabled but 'gravity_point_unit_distance' is ${distance}. This value must be greater than 0 for point gravity to work.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'area3d-point-gravity-invalid-distance',
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
        message: `Area3D '${node.name}' has 'monitoring' enabled but 'collision_layer' is 0. The area won't be on any collision layer.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'area3d-monitoring-zero-layer',
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
        message: `Area3D '${node.name}' has 'monitoring' enabled but 'collision_mask' is 0. The area won't detect any collision layers.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'area3d-monitoring-zero-mask',
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
        message: `Area3D '${node.name}' has 'monitoring' enabled but both 'collision_layer' and 'collision_mask' are 0. The area won't detect anything.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'area3d-monitoring-no-collision',
      });
    }
  }

  // Warning: audio_bus_override is true but audio_bus_name is not set
  const audioBusOverride = rawProps.audio_bus_override === 'true';
  const audioBusName = rawProps.audio_bus_name;
  if (audioBusOverride && !audioBusName) {
    diagnostics.push({
      severity: 'warning',
      message: `Area3D '${node.name}' has 'audio_bus_override' enabled but 'audio_bus_name' is not set. Specify which audio bus to use.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'area3d-audio-override-missing-name',
    });
  }

  return diagnostics;
}

/**
 * Area3D semantic validation rule
 */
const area3DValidationRule: LintRule = {
  meta: {
    name: 'valid-area3d',
    description: 'Validates Area3D collision shapes, monitoring configuration, gravity settings, and physics overrides',
    category: 'validation',
    applicableNodeTypes: ['Area3D'],
  },
  check: checkArea3D,
};

// Self-register the rule
ruleRegistry.register(area3DValidationRule);

// Export for testing
export { area3DValidationRule };
