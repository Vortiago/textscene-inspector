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
import { referencedResourceType } from '../resourceChecker.js';
import { findParentNode } from '../linterUtils.js';
import { descendsFrom } from '../nodeBaseTypes.js';
import { isZeroApprox } from '../../godot/math.js';
import { basisColumnScales } from './basisColumnScales.js';
import type { PhysicsDim } from './dim.js';
import { dimSuffix } from './dim.js';

export function makeCollisionShapeLinterRule(dim: PhysicsDim): LintRule {
  // `one_way_collision` carries PROPERTY_HINT_GROUP_ENABLE for the
  // `one_way_collision` group, so the margin beside it is inert while the
  // toggle is off. 2D only: CollisionShape3D declares neither property.
  const ONE_WAY_GROUP_AT = 'collision_shape_2d.cpp:290';
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

    // Resolved once. `referencedResourceType` and `checkResourceExists` both
    // funnel through one linear scan of the scene's resource tables, so asking
    // separately for existence and for type scanned the same tables twice on
    // every shape-bearing node in the corpus.
    const shapeType = rawProps.shape ? referencedResourceType(scene, rawProps.shape) : undefined;

    // ERROR: shape property is REQUIRED
    if (!rawProps.shape) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' is missing required property 'shape'. A collision shape needs a shape resource to define its collision geometry.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-requires-shape`,
      });
    } else if (shapeType === undefined) {
      // `undefined` from the single resolve above IS "resolves to nothing".
      diagnostics.push({
        severity: 'error',
        message: `Shape resource not found: ${rawProps.shape}. The referenced shape resource must exist in the scene.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `valid-${prefix}-resources`,
      });
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

    // WARNING: ConcavePolygonShape3D / WorldBoundaryShape3D under a body they
    // do not suit (3D only — collision_shape_2d.cpp has no equivalent check).
    // collision_shape_3d.cpp:135-149: `Object::cast_to<RigidBody3D>(col_object)`
    // succeeds for VehicleBody3D too (it extends RigidBody3D), which is why
    // Godot's own message picks `body_type` from a nested VehicleBody3D cast.
    // The push is UNCONDITIONAL on freeze/freeze_mode — "except when frozen" in
    // Godot's own string is message prose, not part of the guard.
    if (dim === '3D' && parent && rawProps.shape) {
      if (descendsFrom(parent.type, 'RigidBody3D')) {
        const bodyType = descendsFrom(parent.type, 'VehicleBody3D') ? 'VehicleBody3D' : 'RigidBody3D';
        if (shapeType === 'ConcavePolygonShape3D') {
          diagnostics.push({
            severity: 'warning',
            message:
              `${type} '${node.name}' uses a ConcavePolygonShape3D under a ${bodyType} ('${parent.name}'). ` +
              `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
              `behave well for a ${bodyType}, except when frozen with freeze_mode set to Static.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-concave-under-rigidbody`,
          });
        } else if (shapeType === 'WorldBoundaryShape3D') {
          diagnostics.push({
            severity: 'warning',
            message:
              `${type} '${node.name}' uses a WorldBoundaryShape3D under a ${bodyType} ('${parent.name}'). ` +
              `WorldBoundaryShape3D doesn't support ${bodyType} in a non-static mode.`,
            nodeName: node.name,
            nodeType: node.type,
            ruleName: `${prefix}-worldboundary-under-rigidbody`,
          });
        }
      } else if (descendsFrom(parent.type, 'CharacterBody3D') && shapeType === 'ConcavePolygonShape3D') {
        diagnostics.push({
          severity: 'warning',
          message:
            `${type} '${node.name}' uses a ConcavePolygonShape3D under a CharacterBody3D ('${parent.name}'). ` +
            `ConcavePolygonShape3D is intended for static bodies like StaticBody3D and will likely not ` +
            `behave well for a CharacterBody3D.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-concave-under-characterbody`,
        });
      }
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

    // WARNING: One Way Collision is ignored under an Area2D (2D only —
    // collision_shape_2d.cpp:182, `one_way_collision && cast_to<Area2D>(col_object)`).
    // Distinct from the `unused-one-way-margin` check below: that one fires
    // regardless of parent type when the margin is set without the flag; this
    // one fires on the flag itself, gated on the PARENT being an Area2D, which
    // ignores one-way collision entirely (it has no solid faces to be one-way about).
    if (dim === '2D' && rawProps.one_way_collision === 'true' && parent && descendsFrom(parent.type, 'Area2D')) {
      diagnostics.push({
        severity: 'warning',
        message: `${type} '${node.name}' has 'one_way_collision' enabled under an Area2D ('${parent.name}'). One Way Collision is ignored when the collision object is an Area2D.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-one-way-ignored-under-area2d`,
      });
    }

    // WARNING: shape resolves to a polygon-based Shape2D with limited editing
    // (2D only — collision_shape_2d.cpp:184-189).
    if (dim === '2D' && rawProps.shape) {
      if (shapeType === 'ConvexPolygonShape2D' || shapeType === 'ConcavePolygonShape2D') {
        diagnostics.push({
          severity: 'warning',
          message: `${type} '${node.name}' uses a ${shapeType}, which has limited editing options in CollisionShape2D. Consider using a CollisionPolygon2D node instead.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: `${prefix}-polygon-shape-limited-editing`,
        });
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
        {
          ruleName: `${prefix}-requires-shape`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        {
          ruleName: `valid-${prefix}-resources`,
          severity: 'error',
          grounding: {
            kind: 'no-engine-counterpart',
            scope: 'dangling-reference',
            because: 'the shape id is not declared anywhere in this file',
          },
        },
        {
          ruleName: `${prefix}-invalid-parent`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        {
          ruleName: `${prefix}-no-parent`,
          severity: 'warning',
          grounding: { kind: 'configuration-warning' },
        },
        // 2D-only branch (dim === '2D'); never emitted by the 3D instantiation
        ...(dim === '2D'
          ? [
              {
                ruleName: `${prefix}-unused-one-way-margin`,
                severity: 'warning' as const,
                grounding: {
                  kind: 'engine-inert',
                  at: ONE_WAY_GROUP_AT,
                  unused: 'the group-enable toggle gates the margin, which is read only while it is on',
                } as const,
              },
              {
                ruleName: `${prefix}-one-way-ignored-under-area2d`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
              {
                ruleName: `${prefix}-polygon-shape-limited-editing`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
            ]
          : []),
        // 3D-only branch (dim === '3D'); never emitted by the 2D instantiation
        ...(dim === '3D'
          ? [
              {
                ruleName: `${prefix}-non-uniform-scale`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
              {
                ruleName: `${prefix}-concave-under-rigidbody`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
              {
                ruleName: `${prefix}-worldboundary-under-rigidbody`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
              {
                ruleName: `${prefix}-concave-under-characterbody`,
                severity: 'warning' as const,
                grounding: { kind: 'configuration-warning' } as const,
              },
            ]
          : []),
      ],
    },
    check,
  };
}
