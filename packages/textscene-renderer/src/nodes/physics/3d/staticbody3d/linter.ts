/**
 * Semantic linter rules for StaticBody3D
 *
 * Note: Format validation (collision_layer values, disable_mode values, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, collision shape children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';

/**
 * Vector3 format regex for extracting numeric values
 */
const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/**
 * Check if a Vector3 string is non-zero (any component != 0)
 */
function isNonZeroVector3(value: string): boolean {
  const match = VECTOR3_REGEX.exec(value);
  if (!match) {
    return false;
  }
  const x = parseFloat(match[1] || '0');
  const y = parseFloat(match[2] || '0');
  const z = parseFloat(match[3] || '0');
  return x !== 0 || y !== 0 || z !== 0;
}

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
 * Validate StaticBody3D semantic rules
 */
function checkStaticBody3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for StaticBody3D nodes
  if (node.type !== 'StaticBody3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // Check if physics_material_override resource exists (if specified)
  if (rawProps.physics_material_override) {
    const resourceExists = checkResourceExists(scene, rawProps.physics_material_override);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Physics material resource not found: ${rawProps.physics_material_override}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-staticbody3d-resources',
      });
    }
  }

  // Warning: StaticBody3D without CollisionShape3D children is useless
  if (!hasCollisionShapeChild(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `StaticBody3D '${node.name}' has no CollisionShape3D children. Static bodies need collision shapes to function in physics.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'staticbody3d-needs-collision-shape',
    });
  }

  // Warning: Non-zero constant_linear_velocity on static body (unusual/confusing)
  if (rawProps.constant_linear_velocity && isNonZeroVector3(rawProps.constant_linear_velocity)) {
    diagnostics.push({
      severity: 'warning',
      message: `StaticBody3D '${node.name}' has non-zero constant_linear_velocity (${rawProps.constant_linear_velocity}). This affects touching bodies but doesn't move the static body itself, which can be confusing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'staticbody3d-constant-velocity-warning',
    });
  }

  // Warning: Non-zero constant_angular_velocity on static body (unusual/confusing)
  if (rawProps.constant_angular_velocity && isNonZeroVector3(rawProps.constant_angular_velocity)) {
    diagnostics.push({
      severity: 'warning',
      message: `StaticBody3D '${node.name}' has non-zero constant_angular_velocity (${rawProps.constant_angular_velocity}). This affects touching bodies but doesn't rotate the static body itself, which can be confusing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'staticbody3d-constant-velocity-warning',
    });
  }

  // Warning: collision_layer is 0 (body won't be on any layer)
  if (rawProps.collision_layer !== undefined) {
    const collisionLayer = parseInt(rawProps.collision_layer, 10);
    if (!isNaN(collisionLayer) && collisionLayer === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `StaticBody3D '${node.name}' has collision_layer set to 0. The body won't be on any collision layer and may not interact with other physics objects.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'staticbody3d-zero-collision-layer',
      });
    }
  }

  // Warning: collision_mask is 0 (body won't collide with anything)
  if (rawProps.collision_mask !== undefined) {
    const collisionMask = parseInt(rawProps.collision_mask, 10);
    if (!isNaN(collisionMask) && collisionMask === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `StaticBody3D '${node.name}' has collision_mask set to 0. The body won't collide with any layers and may not detect collisions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'staticbody3d-zero-collision-mask',
      });
    }
  }

  return diagnostics;
}

/**
 * StaticBody3D semantic validation rule
 */
const staticBody3DValidationRule: LintRule = {
  meta: {
    name: 'valid-staticbody3d',
    description: 'Validates StaticBody3D resource references, collision shapes, and physics configuration',
    category: 'validation',
    applicableNodeTypes: ['StaticBody3D'],
  },
  check: checkStaticBody3D,
};

// Self-register the rule
ruleRegistry.register(staticBody3DValidationRule);

// Export for testing
export { staticBody3DValidationRule };
