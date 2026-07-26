/**
 * Dimension-parameterized semantic linter rule for CollisionShape2D / CollisionShape3D.
 *
 * Genuine dimension-specific seams: the valid parent-body types (3D adds
 * VehicleBody3D) and a 2D-only `one_way_collision_margin` check. Format
 * validation stays in each slice's linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { findParentNode } from '../linterUtils.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

const VALID_PARENT_TYPES: Record<PhysicsDim, string[]> = {
  '2D': ['StaticBody2D', 'RigidBody2D', 'CharacterBody2D', 'Area2D', 'AnimatableBody2D'],
  '3D': ['StaticBody3D', 'RigidBody3D', 'CharacterBody3D', 'Area3D', 'AnimatableBody3D', 'VehicleBody3D'],
};

export function makeCollisionShapeLinterRule(dim: PhysicsDim): LintRule {
  const type = `CollisionShape${dim}`;
  const prefix = `collisionshape${dimSuffix(dim)}`;
  const validParents = VALID_PARENT_TYPES[dim];

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;

    if (node.type !== type) {
      return diagnostics;
    }

    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // ERROR: shape property is REQUIRED
    if (!rawProps.shape) {
      diagnostics.push({
        severity: 'error',
        message: `${type} '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-requires-shape`,
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
          ruleName: `valid-${prefix}-resources`,
        });
      }
    }

    // WARNING: Check if parent is a valid physics body type
    const parent = findParentNode(scene.nodes, node);
    if (parent) {
      if (!validParents.includes(parent.type)) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has parent '${parent.name}' of type '${parent.type}'. ${type} should be a child of ${validParents.join(', ')}.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-invalid-parent`,
        });
      }
    } else {
      // WARNING: CollisionShape at root level (no parent)
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no parent node. ${type} should be a child of ${validParents.join(', ')}.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-no-parent`,
      });
    }

    // WARNING: one_way_collision_margin set but one_way_collision is false (2D only)
    if (dim === '2D' && rawProps.one_way_collision_margin && rawProps.one_way_collision !== 'true') {
      const margin = parseFloat(rawProps.one_way_collision_margin);
      // Only warn if margin is non-zero and one_way_collision is explicitly false or not set
      if (!isNaN(margin) && margin > 0) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has 'one_way_collision_margin' set to ${margin}, but 'one_way_collision' is ${rawProps.one_way_collision || 'not set (defaults to false)'}. The margin will have no effect unless 'one_way_collision' is true.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-unused-one-way-margin`,
        });
      }
    }

    return diagnostics;
  }

  const description =
    dim === '2D'
      ? `Validates ${type} shape resource references, parent node types, and one-way collision configuration`
      : `Validates ${type} shape resource references and parent node types`;

  return {
    meta: {
      name: `valid-${prefix}`,
      description,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-requires-shape`, severity: 'error' },
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-invalid-parent`, severity: 'warning' },
        { ruleName: `${prefix}-no-parent`, severity: 'warning' },
        // 2D-only branch (dim === '2D'); never emitted by the 3D instantiation
        ...(dim === '2D' ? [{ ruleName: `${prefix}-unused-one-way-margin`, severity: 'warning' as const }] : []),
      ],
    },
    check,
  };
}
