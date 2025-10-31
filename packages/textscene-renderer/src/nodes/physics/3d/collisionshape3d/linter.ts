/**
 * Semantic linter rules for CollisionShape3D
 *
 * Note: Format validation (shape resource format, disabled boolean) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., shape resource exists, valid parent type).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';

/**
 * Valid parent types for CollisionShape3D
 * CollisionShape3D must be a child of a physics body or area node
 */
const VALID_PARENT_TYPES = [
  'StaticBody3D',
  'RigidBody3D',
  'CharacterBody3D',
  'Area3D',
  'AnimatableBody3D', // Physics body that can be animated
  'VehicleBody3D', // Specialized rigid body for vehicles
];

/**
 * Find the parent node of a given node in the scene tree
 */
function findParentNode(nodes: TscnNode[], targetNode: TscnNode, parent: TscnNode | null = null): TscnNode | null {
  for (const node of nodes) {
    if (node === targetNode) {
      return parent;
    }
    const foundParent = findParentNode(node.children, targetNode, node);
    if (foundParent !== null) {
      return foundParent;
    }
  }
  return null;
}

/**
 * Validate CollisionShape3D semantic rules
 */
function checkCollisionShape3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for CollisionShape3D nodes
  if (node.type !== 'CollisionShape3D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // ERROR: shape property is REQUIRED
  if (!rawProps.shape) {
    diagnostics.push({
      severity: 'error',
      message: `CollisionShape3D '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionshape3d-requires-shape',
    });
  } else {
    // ERROR: Check if shape resource exists in scene
    const resourceExists = checkResourceExists(scene, rawProps.shape);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Shape resource not found: ${rawProps.shape}. The referenced shape resource must exist in the scene.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-collisionshape3d-resources',
      });
    }
  }

  // WARNING: Check if parent is a valid physics body type
  const parent = findParentNode(scene.nodes, node);
  if (parent) {
    if (!VALID_PARENT_TYPES.includes(parent.type)) {
      diagnostics.push({
        severity: 'warning',
        message: `CollisionShape3D '${node.name}' has parent '${parent.name}' of type '${parent.type}'. CollisionShape3D should be a child of ${VALID_PARENT_TYPES.join(', ')}.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'collisionshape3d-invalid-parent',
      });
    }
  } else {
    // WARNING: CollisionShape3D at root level (no parent)
    // This happens when it's a top-level node in the scene
    diagnostics.push({
      severity: 'warning',
      message: `CollisionShape3D '${node.name}' has no parent node. CollisionShape3D should be a child of ${VALID_PARENT_TYPES.join(', ')}.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionshape3d-no-parent',
    });
  }

  return diagnostics;
}

/**
 * CollisionShape3D semantic validation rule
 */
const collisionShape3DValidationRule: LintRule = {
  meta: {
    name: 'valid-collisionshape3d',
    description: 'Validates CollisionShape3D shape resource references and parent node types',
    category: 'validation',
    applicableNodeTypes: ['CollisionShape3D'],
  },
  check: checkCollisionShape3D,
};

// Self-register the rule
ruleRegistry.register(collisionShape3DValidationRule);

// Export for testing
export { collisionShape3DValidationRule };
