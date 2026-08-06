/**
 * Dimension-parameterized semantic linter rule for CollisionShape2D / CollisionShape3D.
 *
 * Genuine dimension-specific seams: the valid parent-body types (3D adds
 * VehicleBody3D), a 2D-only `one_way_collision_margin` check, and a 3D-only
 * non-uniform-scale check — collision_shape_3d.cpp:153-156 has no 2D
 * equivalent (collision_shape_2d.cpp's get_configuration_warnings() carries
 * no scale check at all). Format validation stays in each slice's
 * linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../types.js';
import { checkResourceExists } from '../resourceChecker.js';
import { findParentNode } from '../linterUtils.js';
import { descendsFrom } from '../nodeBaseTypes.js';
import { parseTransform3D } from '../../utils/transform.js';
import { isZeroApprox } from '../../godot/math.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

/**
 * Unsigned basis-column magnitudes of a `Transform3D(...)` literal, or null when
 * it does not parse — collision_shape_3d.cpp:153, `get_transform().get_basis()`.
 * `parseTransform3D` returns Godot's Basis ROWS (utils/transform.ts docblock), so
 * column `i` is the `i`-th component picked from each of the three rows.
 *
 * Godot's actual `get_scale()` (basis.cpp:300-321) multiplies these magnitudes
 * by a single `det_sign` shared across all three axes, which cancels out of
 * every pairwise difference below — so the unsigned form is exact for this
 * equality check, never an approximation of it.
 */
function basisColumnScales(raw: string): [number, number, number] | null {
  try {
    const { basis_x, basis_y, basis_z } = parseTransform3D(raw);
    return [
      Math.hypot(basis_x.x, basis_y.x, basis_z.x),
      Math.hypot(basis_x.y, basis_y.y, basis_z.y),
      Math.hypot(basis_x.z, basis_y.z, basis_z.z),
    ];
  } catch {
    return null; // malformed literal is linterParser.ts's job, not this rule's
  }
}

export function makeCollisionShapeLinterRule(dim: PhysicsDim): LintRule {
  const type = `CollisionShape${dim}`;
  const prefix = `collisionshape${dimSuffix(dim)}`;
  const collisionObject = `CollisionObject${dim}`;
  // Prose only. The check asks the base chain, because Godot's test is
  // `Object::cast_to<CollisionObject2D>(get_parent())` (collision_shape_2d.cpp:174),
  // not a list of names.
  const examples = ['Area', 'StaticBody', 'RigidBody', 'CharacterBody']
    .map((n) => n + dim)
    .join(', ');
  const advice = `${type} only gives a shape to a ${collisionObject}: use it under ${examples} or another subclass.`;

  function check(context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const { node, scene } = context;


    // Access raw properties from the node (Record<string, string>)
    const rawProps = node.properties as unknown as Record<string, string>;

    // ERROR: shape property is REQUIRED
    if (!rawProps.shape) {
      diagnostics.push({
        severity: 'warning',
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
      if (!descendsFrom(parent.type, collisionObject)) {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' has parent '${parent.name}' of type '${parent.type}', which is not a ${collisionObject}. ${advice}`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-invalid-parent`,
        });
      }
    } else {
      // WARNING: CollisionShape at root level (no parent)
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has no parent node. ${advice}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-no-parent`,
      });
    }

    // WARNING: non-uniform scale (3D only — collision_shape_2d.cpp's
    // get_configuration_warnings() has no equivalent check)
    if (dim === '3D' && rawProps.transform !== undefined) {
      const scales = basisColumnScales(rawProps.transform);
      if (scales) {
        const [sx, sy, sz] = scales;
        if (!(isZeroApprox(sx - sy) && isZeroApprox(sy - sz))) {
          diagnostics.push({
            severity: 'warning',
            message:
              `${type} '${node.name}' has a non-uniformly scaled transform ` +
              `(${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}), which will probably not ` +
              'function as expected. Keep its scale uniform and change the size of its shape resource instead.',
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-non-uniform-scale`,
          });
        }
      }
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
      : `Validates ${type} shape resource references, parent node types, and transform scale uniformity`;

  return {
    meta: {
      name: `valid-${prefix}`,
      description,
      category: 'validation',
      applicableNodeTypes: [type],
      emits: [
        { ruleName: `${prefix}-requires-shape`, severity: 'warning' },
        { ruleName: `valid-${prefix}-resources`, severity: 'error' },
        { ruleName: `${prefix}-invalid-parent`, severity: 'warning' },
        { ruleName: `${prefix}-no-parent`, severity: 'warning' },
        // 2D-only branch (dim === '2D'); never emitted by the 3D instantiation
        ...(dim === '2D' ? [{ ruleName: `${prefix}-unused-one-way-margin`, severity: 'warning' as const }] : []),
        // 3D-only branch (dim === '3D'); never emitted by the 2D instantiation
        ...(dim === '3D' ? [{ ruleName: `${prefix}-non-uniform-scale`, severity: 'warning' as const }] : []),
      ],
    },
    check,
  };
}
