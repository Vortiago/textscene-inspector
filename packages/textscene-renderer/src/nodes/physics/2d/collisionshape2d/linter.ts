/**
 * Semantic linter rules for CollisionShape2D
 *
 * Note: Format validation (shape resource format, disabled boolean, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., shape resource exists, valid parent type).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';

/**
 * Valid parent types for CollisionShape2D
 * CollisionShape2D must be a child of a 2D physics body or area node
 */
const VALID_PARENT_TYPES = [
  'StaticBody2D',
  'RigidBody2D',
  'CharacterBody2D',
  'Area2D',
  'AnimatableBody2D', // 2D version of physics body that can be animated
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
 * Validate CollisionShape2D semantic rules
 */
function checkCollisionShape2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  // Only run for CollisionShape2D nodes
  if (node.type !== 'CollisionShape2D') {
    return diagnostics;
  }

  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // ERROR: shape property is REQUIRED
  if (!rawProps.shape) {
    diagnostics.push({
      severity: 'error',
      message: `CollisionShape2D '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionshape2d-requires-shape',
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
        ruleName: 'valid-collisionshape2d-resources',
      });
    }
  }

  // WARNING: Check if parent is a valid physics body type
  const parent = findParentNode(scene.nodes, node);
  if (parent) {
    if (!VALID_PARENT_TYPES.includes(parent.type)) {
      diagnostics.push({
        severity: 'warning',
        message: `CollisionShape2D '${node.name}' has parent '${parent.name}' of type '${parent.type}'. CollisionShape2D should be a child of ${VALID_PARENT_TYPES.join(', ')}.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'collisionshape2d-invalid-parent',
      });
    }
  } else {
    // WARNING: CollisionShape2D at root level (no parent)
    // This happens when it's a top-level node in the scene
    diagnostics.push({
      severity: 'warning',
      message: `CollisionShape2D '${node.name}' has no parent node. CollisionShape2D should be a child of ${VALID_PARENT_TYPES.join(', ')}.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'collisionshape2d-no-parent',
    });
  }

  // WARNING: one_way_collision_margin set but one_way_collision is false
  if (rawProps.one_way_collision_margin && rawProps.one_way_collision !== 'true') {
    const margin = parseFloat(rawProps.one_way_collision_margin);
    // Only warn if margin is non-zero and one_way_collision is explicitly false or not set
    if (!isNaN(margin) && margin > 0) {
      diagnostics.push({
        severity: 'warning',
        message: `CollisionShape2D '${node.name}' has 'one_way_collision_margin' set to ${margin}, but 'one_way_collision' is ${rawProps.one_way_collision || 'not set (defaults to false)'}. The margin will have no effect unless 'one_way_collision' is true.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'collisionshape2d-unused-one-way-margin',
      });
    }
  }

  return diagnostics;
}

/**
 * CollisionShape2D semantic validation rule
 */
const collisionShape2DValidationRule: LintRule = {
  meta: {
    name: 'valid-collisionshape2d',
    description: 'Validates CollisionShape2D shape resource references, parent node types, and one-way collision configuration',
    category: 'validation',
    applicableNodeTypes: ['CollisionShape2D'],
  },
  check: checkCollisionShape2D,
};

// Self-register the rule
ruleRegistry.register(collisionShape2DValidationRule);

// Export for testing
export { collisionShape2DValidationRule };
