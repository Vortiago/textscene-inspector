/**
 * Semantic linter rules for RigidBody2D
 *
 * Format validation (mass > 0, enum values, Vector2 format, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, collision shape children).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';

/**
 * Minimum recommended mass value (below this causes instability)
 */
const MIN_RECOMMENDED_MASS = 0.01;

/**
 * Maximum recommended mass value (above this can cause instability)
 */
const MAX_RECOMMENDED_MASS = 10000;

/**
 * Maximum recommended damping value (above this causes objects to stop too quickly)
 */
const MAX_RECOMMENDED_DAMPING = 10;

/**
 * Check if a node has any CollisionShape2D children (recursively)
 */
function hasCollisionShapeChild(node: TscnNode): boolean {
  for (const child of node.children) {
    if (child.type === 'CollisionShape2D') {
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
 * Validate RigidBody2D semantic rules
 */
function checkRigidBody2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for RigidBody2D nodes
  if (node.type !== 'RigidBody2D') {
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
        ruleName: 'valid-rigidbody2d-resources',
      });
    }
  }

  // Warning: RigidBody2D without CollisionShape2D children is useless
  if (!hasCollisionShapeChild(node)) {
    diagnostics.push({
      severity: 'warning',
      message: `RigidBody2D '${node.name}' has no CollisionShape2D children. Rigid bodies need collision shapes to function in physics.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'rigidbody2d-needs-collision-shape',
    });
  }

  // Warning: Extreme mass values can cause instability
  if (rawProps.mass !== undefined) {
    const mass = parseFloat(rawProps.mass);
    if (!isNaN(mass)) {
      if (mass < MIN_RECOMMENDED_MASS) {
        diagnostics.push({
          severity: 'warning',
          message: `RigidBody2D '${node.name}' has very low mass (${mass}). Values below ${MIN_RECOMMENDED_MASS} can cause physics instability.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'rigidbody2d-mass-too-low',
        });
      }
      if (mass > MAX_RECOMMENDED_MASS) {
        diagnostics.push({
          severity: 'warning',
          message: `RigidBody2D '${node.name}' has very high mass (${mass}). Values above ${MAX_RECOMMENDED_MASS} can cause physics instability.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'rigidbody2d-mass-too-high',
        });
      }
    }
  }

  // Warning: Excessive linear damping
  if (rawProps.linear_damp !== undefined) {
    const linearDamp = parseFloat(rawProps.linear_damp);
    if (!isNaN(linearDamp) && linearDamp > MAX_RECOMMENDED_DAMPING) {
      diagnostics.push({
        severity: 'warning',
        message: `RigidBody2D '${node.name}' has high linear_damp (${linearDamp}). Values above ${MAX_RECOMMENDED_DAMPING} cause objects to stop too quickly.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'rigidbody2d-excessive-linear-damp',
      });
    }
  }

  // Warning: Excessive angular damping
  if (rawProps.angular_damp !== undefined) {
    const angularDamp = parseFloat(rawProps.angular_damp);
    if (!isNaN(angularDamp) && angularDamp > MAX_RECOMMENDED_DAMPING) {
      diagnostics.push({
        severity: 'warning',
        message: `RigidBody2D '${node.name}' has high angular_damp (${angularDamp}). Values above ${MAX_RECOMMENDED_DAMPING} cause objects to stop rotating too quickly.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'rigidbody2d-excessive-angular-damp',
      });
    }
  }

  // Warning: max_contacts_reported set but contact_monitor=false
  if (rawProps.max_contacts_reported !== undefined) {
    const contactMonitor = rawProps.contact_monitor;
    if (contactMonitor !== 'true') {
      diagnostics.push({
        severity: 'warning',
        message: `RigidBody2D '${node.name}' has max_contacts_reported set but contact_monitor is not enabled. The property won't work unless contact_monitor=true.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'rigidbody2d-max-contacts-without-monitor',
      });
    }
  }

  // Warning: collision_layer is 0 (body won't be on any layer)
  if (rawProps.collision_layer !== undefined) {
    const collisionLayer = parseInt(rawProps.collision_layer, 10);
    if (!isNaN(collisionLayer) && collisionLayer === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `RigidBody2D '${node.name}' has collision_layer set to 0. The body won't be on any collision layer and may not interact with other physics objects.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'rigidbody2d-zero-collision-layer',
      });
    }
  }

  // Warning: collision_mask is 0 (body won't collide with anything)
  if (rawProps.collision_mask !== undefined) {
    const collisionMask = parseInt(rawProps.collision_mask, 10);
    if (!isNaN(collisionMask) && collisionMask === 0) {
      diagnostics.push({
        severity: 'warning',
        message: `RigidBody2D '${node.name}' has collision_mask set to 0. The body won't collide with any layers and may not detect collisions.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'rigidbody2d-zero-collision-mask',
      });
    }
  }

  return diagnostics;
}

/**
 * RigidBody2D semantic validation rule
 */
const rigidBody2DValidationRule: LintRule = {
  meta: {
    name: 'valid-rigidbody2d',
    description: 'Validates RigidBody2D resource references, collision shapes, mass values, and physics configuration',
    category: 'validation',
    applicableNodeTypes: ['RigidBody2D'],
  },
  check: checkRigidBody2D,
};

// Self-register the rule
ruleRegistry.register(rigidBody2DValidationRule);

// Export for testing
export { rigidBody2DValidationRule };
